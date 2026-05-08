type AlbumPreviewGridProps = {
  urls: string[]
  compact?: boolean
}

export default function AlbumPreviewGrid({ urls, compact = false }: AlbumPreviewGridProps) {
  const visibleUrls = urls.slice(0, 4)
  const layoutCount = Math.max(1, Math.min(visibleUrls.length, 4))
  const extraCount = Math.max(0, urls.length - 4)

  if (visibleUrls.length === 0) return null

  return (
    <div className={`album-preview-grid album-preview-grid-${layoutCount}${compact ? ' album-preview-grid-compact' : ''}`}>
      {visibleUrls.map((url, index) => (
        <div
          key={`${url}-${index}`}
          className="album-preview-tile"
          role="img"
          aria-label={`Album image ${index + 1}`}
          style={{ backgroundImage: `url(${url})` }}
        >
          {index === 3 && extraCount > 0 && (
            <span className="album-preview-extra">+{extraCount}</span>
          )}
        </div>
      ))}
    </div>
  )
}
