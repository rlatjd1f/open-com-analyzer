import AppKit

func createIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    
    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let margin = size * 0.1
    let innerRect = rect.insetBy(dx: margin, dy: margin)
    let cornerRadius = size * 0.22
    
    // Squircle background with gradient
    let path = NSBezierPath(roundedRect: innerRect, xRadius: cornerRadius, yRadius: cornerRadius)
    
    // Background gradient (Deep Slate / Navy)
    let startColor = NSColor(calibratedRed: 0.10, green: 0.12, blue: 0.18, alpha: 1.0)
    let endColor = NSColor(calibratedRed: 0.05, green: 0.06, blue: 0.09, alpha: 1.0)
    let gradient = NSGradient(starting: startColor, ending: endColor)
    gradient?.draw(in: path, angle: -45)
    
    // Subtle border
    NSColor(calibratedWhite: 1.0, alpha: 0.15).setStroke()
    path.lineWidth = size * 0.015
    path.stroke()
    
    // Draw central grid cells (representing the COM Analyzer matrix!)
    let gridSize: CGFloat = 3
    let cellW = (innerRect.width * 0.6) / gridSize
    let cellGap = size * 0.02
    let startX = innerRect.midX - (cellW * gridSize + cellGap * (gridSize - 1)) / 2
    let startY = innerRect.midY - (cellW * gridSize + cellGap * (gridSize - 1)) / 2
    
    // Draw 3x3 grid cells: orange (RX) and cyan (TX)
    for row in 0..<3 {
        for col in 0..<3 {
            let cx = startX + CGFloat(col) * (cellW + cellGap)
            let cy = startY + CGFloat(row) * (cellW + cellGap)
            let cellRect = NSRect(x: cx, y: cy, width: cellW, height: cellW)
            let cellPath = NSBezierPath(roundedRect: cellRect, xRadius: size * 0.025, yRadius: size * 0.025)
            
            if (row + col) % 2 == 0 {
                // RX Orange
                NSColor(calibratedRed: 1.0, green: 0.6, blue: 0.0, alpha: 0.95).setFill()
            } else {
                // TX Cyan
                NSColor(calibratedRed: 0.0, green: 0.8, blue: 0.85, alpha: 0.95).setFill()
            }
            cellPath.fill()
        }
    }
    
    // Overlay text: "COM" at the top inside squircle
    let text = "COM"
    let font = NSFont.boldSystemFont(ofSize: size * 0.14)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor.white
    ]
    let textSize = (text as NSString).size(withAttributes: attrs)
    let textRect = NSRect(
        x: innerRect.midX - textSize.width / 2,
        y: innerRect.maxY - textSize.height - size * 0.04,
        width: textSize.width,
        height: textSize.height
    )
    (text as NSString).draw(in: textRect, withAttributes: attrs)
    
    image.unlockFocus()
    return image
}

func savePNG(image: NSImage, path: String) {
    if let tiffData = image.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiffData),
       let pngData = rep.representation(using: .png, properties: [:]) {
        try? pngData.write(to: URL(fileURLWithPath: path))
    }
}

let fm = FileManager.default
let iconsetPath = "assets/icon.iconset"
try? fm.createDirectory(atPath: iconsetPath, withIntermediateDirectories: true, attributes: nil)

let sizes: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (name, s) in sizes {
    let img = createIcon(size: s)
    savePNG(image: img, path: "\(iconsetPath)/\(name)")
}

print("Iconset generated successfully!")
