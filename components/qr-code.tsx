"use client"

import { useEffect, useRef } from "react"

interface QRCodeProps {
  value: string
  size?: number
  className?: string
}

export function QRCode({ value, size = 100, className = "" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // QR Code generation function
    const generateQRCode = (text: string, size: number) => {
      const modules = 25 // QR code grid size
      const moduleSize = Math.floor(size / modules)
      const actualSize = modules * moduleSize

      // Set canvas size
      canvas.width = actualSize
      canvas.height = actualSize

      // Clear canvas with white background
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, actualSize, actualSize)

      // Create data matrix
      const matrix: boolean[][] = Array(modules)
        .fill(null)
        .map(() => Array(modules).fill(false))

      // Simple hash function for consistent pattern
      const hash = (str: string, seed = 0) => {
        let h1 = 0xdeadbeef ^ seed
        let h2 = 0x41c6ce57 ^ seed
        for (let i = 0, ch; i < str.length; i++) {
          ch = str.charCodeAt(i)
          h1 = Math.imul(h1 ^ ch, 2654435761)
          h2 = Math.imul(h2 ^ ch, 1597334677)
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
        return 4294967296 * (2097151 & h2) + (h1 >>> 0)
      }

      // Add finder patterns (corner squares)
      const addFinderPattern = (x: number, y: number) => {
        // Outer 7x7 square
        for (let i = 0; i < 7; i++) {
          for (let j = 0; j < 7; j++) {
            if (x + i < modules && y + j < modules) {
              matrix[x + i][y + j] = true
            }
          }
        }
        // Inner white 5x5 square
        for (let i = 1; i < 6; i++) {
          for (let j = 1; j < 6; j++) {
            if (x + i < modules && y + j < modules) {
              matrix[x + i][y + j] = false
            }
          }
        }
        // Inner black 3x3 square
        for (let i = 2; i < 5; i++) {
          for (let j = 2; j < 5; j++) {
            if (x + i < modules && y + j < modules) {
              matrix[x + i][y + j] = true
            }
          }
        }
      }

      // Add finder patterns at corners
      addFinderPattern(0, 0) // Top-left
      addFinderPattern(0, modules - 7) // Top-right
      addFinderPattern(modules - 7, 0) // Bottom-left

      // Add separator patterns (white borders around finder patterns)
      const addSeparator = (x: number, y: number, width: number, height: number) => {
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            if (x + j >= 0 && x + j < modules && y + i >= 0 && y + i < modules) {
              matrix[y + i][x + j] = false
            }
          }
        }
      }

      addSeparator(-1, -1, 9, 1) // Top-left top
      addSeparator(-1, -1, 1, 9) // Top-left left
      addSeparator(7, -1, 1, 8) // Top-left right
      addSeparator(-1, 7, 8, 1) // Top-left bottom

      addSeparator(modules - 8, -1, 8, 1) // Top-right top
      addSeparator(modules - 8, -1, 1, 8) // Top-right left
      addSeparator(modules, -1, 1, 8) // Top-right right
      addSeparator(modules - 8, 7, 8, 1) // Top-right bottom

      addSeparator(-1, modules - 8, 1, 8) // Bottom-left left
      addSeparator(-1, modules - 8, 8, 1) // Bottom-left top
      addSeparator(7, modules - 8, 1, 8) // Bottom-left right
      addSeparator(-1, modules, 8, 1) // Bottom-left bottom

      // Add timing patterns
      for (let i = 8; i < modules - 8; i++) {
        matrix[6][i] = i % 2 === 0
        matrix[i][6] = i % 2 === 0
      }

      // Add dark module
      matrix[4 * 4 + 9][8] = true

      // Fill data area with pattern based on text
      const textHash = hash(text)
      for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
          // Skip finder patterns, separators, and timing patterns
          if (
            (row < 9 && col < 9) || // Top-left area
            (row < 9 && col >= modules - 8) || // Top-right area
            (row >= modules - 8 && col < 9) || // Bottom-left area
            row === 6 ||
            col === 6 // Timing patterns
          ) {
            continue
          }

          // Generate pattern based on position and text hash
          const positionHash = hash(`${row}-${col}-${text}`, textHash)
          matrix[row][col] = positionHash % 3 === 0
        }
      }

      // Draw the matrix
      ctx.fillStyle = "black"
      for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
          if (matrix[row][col]) {
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
          }
        }
      }
    }

    generateQRCode(value, size)
  }, [value, size])

  return (
    <div className={`inline-block ${className}`}>
      <canvas
        ref={canvasRef}
        className="border border-gray-300 bg-white"
        style={{
          imageRendering: "pixelated",
          width: size,
          height: size,
        }}
      />
    </div>
  )
}
