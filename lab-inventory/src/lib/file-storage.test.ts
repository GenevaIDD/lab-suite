import { describe, it, expect } from 'vitest'
import { toObjectPath, PHOTO_BUCKET, DOC_BUCKET } from './file-storage'

// Stored references come in two shapes: bare object paths (written since the
// switch to signed URLs) and full getPublicUrl() results (written before it,
// and rewritten by fix_storage_signed_urls.sql). Both must resolve.

const PROJECT = 'https://eviwieggwuweqezkrtli.supabase.co'

describe('toObjectPath', () => {
  it('passes a bare path through unchanged', () => {
    expect(toObjectPath('abc-123.jpg', PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('extracts the path from a legacy public URL', () => {
    const url = `${PROJECT}/storage/v1/object/public/${PHOTO_BUCKET}/abc-123.jpg`
    expect(toObjectPath(url, PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('extracts the path from a document public URL', () => {
    const url = `${PROJECT}/storage/v1/object/public/${DOC_BUCKET}/manual.pdf`
    expect(toObjectPath(url, DOC_BUCKET)).toBe('manual.pdf')
  })

  it('extracts the path from a signed URL and drops the token', () => {
    const url = `${PROJECT}/storage/v1/object/sign/${PHOTO_BUCKET}/abc-123.jpg?token=eyJhbGciOi`
    expect(toObjectPath(url, PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('extracts the path from an authenticated object URL', () => {
    const url = `${PROJECT}/storage/v1/object/${PHOTO_BUCKET}/abc-123.jpg`
    expect(toObjectPath(url, PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('drops a query string from a bare path', () => {
    expect(toObjectPath('abc-123.jpg?v=2', PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('strips a leading slash', () => {
    expect(toObjectPath('/abc-123.jpg', PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('trims surrounding whitespace', () => {
    expect(toObjectPath('  abc-123.jpg  ', PHOTO_BUCKET)).toBe('abc-123.jpg')
  })

  it('returns empty for an empty reference', () => {
    expect(toObjectPath('', PHOTO_BUCKET)).toBe('')
    expect(toObjectPath('   ', PHOTO_BUCKET)).toBe('')
  })

  it('does not confuse one bucket for the other', () => {
    // A photo URL resolved against the documents bucket has no matching
    // marker, so it falls through rather than silently yielding a wrong key.
    const url = `${PROJECT}/storage/v1/object/public/${PHOTO_BUCKET}/abc-123.jpg`
    expect(toObjectPath(url, DOC_BUCKET)).not.toBe('abc-123.jpg')
  })

  it('preserves nested object keys', () => {
    const url = `${PROJECT}/storage/v1/object/public/${DOC_BUCKET}/2026/invoices/scan.pdf`
    expect(toObjectPath(url, DOC_BUCKET)).toBe('2026/invoices/scan.pdf')
  })

  it('is idempotent', () => {
    const url = `${PROJECT}/storage/v1/object/public/${PHOTO_BUCKET}/abc-123.jpg`
    const once = toObjectPath(url, PHOTO_BUCKET)
    expect(toObjectPath(once, PHOTO_BUCKET)).toBe(once)
  })
})
