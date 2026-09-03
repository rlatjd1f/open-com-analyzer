import subprocess
import sys

def main():
    prev_tag = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
    cur_tag = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else 'HEAD'

    range_str = f"{prev_tag}..{cur_tag}" if prev_tag else cur_tag
    cmd = ["git", "log", range_str, "--no-merges", "--pretty=format:COMMIT_SEP%h|%s%n%b"]

    try:
        output = subprocess.check_output(cmd, text=True)
        entries = []
        for block in output.strip().split("COMMIT_SEP"):
            if not block.strip():
                continue
            lines = block.strip().split("\n")
            header = lines[0]
            body = "\n".join(lines[1:]).strip()
            if "|" in header:
                hash_val, subject = header.split("|", 1)
                if subject.startswith("chore: release"):
                    continue
                entries.append((hash_val, subject, body))

        with open("RELEASE_BODY.md", "a", encoding="utf-8") as f:
            for hash_val, subject, body in entries:
                f.write(f"* **{subject}** (`{hash_val}`)\n")
                if body:
                    for b_line in body.split("\n"):
                        b_line = b_line.strip()
                        if b_line:
                            if b_line.startswith("-") or b_line.startswith("*"):
                                f.write(f"  {b_line}\n")
                            else:
                                f.write(f"  - {b_line}\n")
                f.write("\n")
    except Exception as e:
        print(f"Error generating changelog: {e}")

if __name__ == "__main__":
    main()
