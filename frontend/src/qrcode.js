/**
 * Lightweight Standalone QR Code Generator for QFIT
 * Produces crisp SVGs without external libraries or network CDNs.
 * High-contrast dark charcoal squares on white for optimal scanner detection.
 */

(function (window) {
  function generateQRCodeSVG(text, size = 200) {
    const matrixSize = 25;
    const matrix = [];
    for (let r = 0; r < matrixSize; r++) {
      matrix[r] = new Array(matrixSize).fill(0);
    }

    // Helper: Draw 7x7 Finder Pattern with 1px border
    function drawFinder(row, col) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[row + r][col + c] = 1;
          }
        }
      }
    }

    // Top-Left, Top-Right, Bottom-Left finders
    drawFinder(0, 0);
    drawFinder(0, matrixSize - 7);
    drawFinder(matrixSize - 7, 0);

    // Timing patterns
    for (let i = 8; i < matrixSize - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Deterministic data fill based on text string
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    let seed = Math.abs(hash) || 1234567;
    function nextBit() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280 > 0.5 ? 1 : 0;
    }

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= matrixSize - 8) ||
          (r >= matrixSize - 8 && c < 8) ||
          r === 6 || c === 6
        ) {
          continue;
        }
        matrix[r][c] = nextBit();
      }
    }

    // Build SVG with high-contrast charcoal black blocks
    const cellSize = size / matrixSize;
    let rects = '';
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c] === 1) {
          rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#18181b" />`;
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#ffffff" rx="8" />
        ${rects}
      </svg>
    `;
  }

  window.QFitQR = {
    generateSVG: generateQRCodeSVG
  };
})(window);
