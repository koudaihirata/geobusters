export type TrimOptions = {
  threshold?: number
}

export const trimImage = (img: HTMLImageElement, options: TrimOptions = {}) => {
  const threshold = options.threshold ?? 250
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  let top = height
  let left = width
  let right = 0
  let bottom = 0
  let found = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]

      const isWhite = r >= threshold && g >= threshold && b >= threshold
      const isTransparent = a === 0

      if (!isWhite && !isTransparent) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
        found = true
      }
    }
  }

  if (!found) return null

  const trimWidth = right - left + 1
  const trimHeight = bottom - top + 1
  const out = document.createElement('canvas')
  const outCtx = out.getContext('2d')
  if (!outCtx) return null

  out.width = trimWidth
  out.height = trimHeight
  outCtx.drawImage(canvas, left, top, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight)

  return out.toDataURL('image/png')
}
