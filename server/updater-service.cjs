const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const packageJson = require('../package.json');

const REPO_OWNER = 'rlatjd1f';
const REPO_NAME = 'open-com-analyzer';

function parseSemver(ver) {
  if (!ver) return [0, 0, 0];
  const clean = ver.replace(/^v/, '').trim();
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerVersion(latest, current) {
  const [lMaj, lMin, lPat] = parseSemver(latest);
  const [cMaj, cMin, cPat] = parseSemver(current);
  if (lMaj > cMaj) return true;
  if (lMaj === cMaj && lMin > cMin) return true;
  if (lMaj === cMaj && lMin === cMin && lPat > cPat) return true;
  return false;
}

class UpdaterService {
  constructor() {
    this.currentVersion = packageJson.version || '0.0.2';
  }

  async checkForUpdates() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        headers: {
          'User-Agent': 'Open-COM-Analyzer-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.get(options, (res) => {
        if (res.statusCode === 404) {
          return resolve({
            hasUpdate: false,
            currentVersion: this.currentVersion,
            message: '발행된 릴리즈가 없습니다.'
          });
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const latestTag = release.tag_name || '';
            const latestVersion = latestTag.replace(/^v/, '');
            const hasUpdate = isNewerVersion(latestVersion, this.currentVersion);

            // Determine matching asset for current OS & arch
            let matchedAsset = null;
            const platform = process.platform;
            const arch = process.arch;

            if (release.assets && Array.isArray(release.assets)) {
              if (platform === 'darwin') {
                if (arch === 'arm64') {
                  matchedAsset = release.assets.find(a => a.name.includes('macOS-arm64.zip'));
                }
                if (!matchedAsset) {
                  matchedAsset = release.assets.find(a => a.name.includes('macOS-x64.zip') || a.name.includes('macOS.zip'));
                }
              } else if (platform === 'win32') {
                matchedAsset = release.assets.find(a => a.name.includes('Windows-x64.zip') || a.name.includes('.zip'));
              }
            }

            resolve({
              hasUpdate,
              currentVersion: this.currentVersion,
              latestVersion: latestTag || latestVersion,
              releaseTitle: release.name || latestTag,
              releaseNotes: release.body || '',
              publishedAt: release.published_at,
              assetUrl: matchedAsset ? matchedAsset.browser_download_url : null,
              assetName: matchedAsset ? matchedAsset.name : null,
              assetSize: matchedAsset ? matchedAsset.size : 0
            });
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('업데이트 서버 연결 시간 초과'));
      });
    });
  }

  downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const handleRequest = (currentUrl) => {
        const protocol = currentUrl.startsWith('https') ? https : http;
        const req = protocol.get(currentUrl, {
          headers: { 'User-Agent': 'Open-COM-Analyzer-App' }
        }, (res) => {
          // Follow HTTP redirects (GitHub Releases redirect to AWS S3)
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            if (res.headers.location) {
              return handleRequest(res.headers.location);
            }
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with status ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            fileStream.write(chunk);
            if (onProgress && totalBytes > 0) {
              const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
              onProgress({
                percent,
                downloaded: downloadedBytes,
                total: totalBytes
              });
            }
          });

          res.on('end', () => {
            fileStream.end();
            resolve();
          });

          res.on('error', (err) => {
            fileStream.close();
            reject(err);
          });
        });

        req.on('error', reject);
      };

      handleRequest(url);
    });
  }

  async installUpdate(assetUrl, onProgress) {
    if (!assetUrl) {
      throw new Error('다운로드 가능한 업데이트 아티팩트 URL이 없습니다.');
    }

    const tempDir = path.join(os.tmpdir(), 'com-analyzer-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const zipPath = path.join(tempDir, 'update.zip');
    const extractDir = path.join(tempDir, 'extracted');

    // Clean old extractions
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    // Step 1: Download zip
    await this.downloadFile(assetUrl, zipPath, onProgress);

    // Step 2: Extract and replace
    if (process.platform === 'darwin') {
      return new Promise((resolve, reject) => {
        // macOS: ditto extracts zip preserving resource forks and symlinks
        exec(`ditto -x -k "${zipPath}" "${extractDir}"`, (err) => {
          if (err) return reject(new Error(`압축 해제 실패: ${err.message}`));

          // Look for .app in extracted directory
          const appName = 'COM Analyzer.app';
          const srcAppPath = path.join(extractDir, appName);
          const targetAppPath = '/Applications/COM Analyzer.app';

          if (!fs.existsSync(srcAppPath)) {
            // Check subdirectories
            const files = fs.readdirSync(extractDir);
            let found = null;
            for (const f of files) {
              if (f.endsWith('.app')) {
                found = path.join(extractDir, f);
                break;
              }
            }
            if (!found) {
              return reject(new Error('압축 파일 내에서 COM Analyzer.app을 찾을 수 없습니다.'));
            }
          }

          const actualSrc = fs.existsSync(srcAppPath) ? srcAppPath : path.join(extractDir, fs.readdirSync(extractDir).find(f => f.endsWith('.app')));

          // Remove quarantine and copy to /Applications
          const replaceCmd = `xattr -cr "${actualSrc}" && rm -rf "${targetAppPath}" && cp -R "${actualSrc}" /Applications/ && xattr -cr "${targetAppPath}" && touch "${targetAppPath}"`;
          exec(replaceCmd, (replaceErr) => {
            if (replaceErr) {
              return reject(new Error(`앱 대치 실패: ${replaceErr.message}`));
            }

            resolve({ success: true, message: '업데이트가 완료되었습니다. 앱을 재실행합니다.' });

            // Create detached relaunch script that waits for current app to exit, then launches the updated app
            try {
              const relaunchScript = path.join(tempDir, 'relaunch.sh');
              const scriptContent = `#!/bin/bash
sleep 1
pkill -9 -f "COM Analyzer" 2>/dev/null || true
sleep 0.5
xattr -cr "${targetAppPath}" 2>/dev/null || true
open "${targetAppPath}"
`;
              fs.writeFileSync(relaunchScript, scriptContent, { mode: 0o755 });

              const { spawn } = require('child_process');
              const sub = spawn('/bin/bash', [relaunchScript], {
                detached: true,
                stdio: 'ignore'
              });
              sub.unref();
            } catch (spawnErr) {
              console.warn('Failed to spawn detached relaunch script:', spawnErr);
            }

            setTimeout(() => {
              process.exit(0);
            }, 600);
          });
        });
      });
    } else if (process.platform === 'win32') {
      return new Promise((resolve, reject) => {
        // Windows extraction using tar (built-in in Windows 10/11) or PowerShell
        exec(`tar -xf "${zipPath}" -C "${extractDir}"`, (err) => {
          if (err) return reject(new Error(`압축 해제 실패: ${err.message}`));

          const currentExe = process.execPath;
          const currentDir = path.dirname(currentExe);
          const batPath = path.join(tempDir, 'update.bat');

          // Batch script to wait, overwrite, and relaunch
          const batContent = `
@echo off
timeout /t 1 /nobreak >nul
xcopy /s /y /e "${extractDir}\\*" "${currentDir}\\"
start "" "${currentExe}"
del "%~f0"
`;
          fs.writeFileSync(batPath, batContent, 'utf-8');

          resolve({ success: true, message: '업데이트가 완료되었습니다. 앱을 재실행합니다.' });

          setTimeout(() => {
            exec(`start "" "${batPath}"`, { windowsHide: true });
            setTimeout(() => process.exit(0), 500);
          }, 500);
        });
      });
    } else {
      throw new Error(`지원되지 않는 OS 플랫폼: ${process.platform}`);
    }
  }
}

module.exports = UpdaterService;
