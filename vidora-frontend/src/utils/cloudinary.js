export function optimizeCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return url;

  // Ensure https
  let secureUrl = url.replace(/^http:\/\//i, 'https://');

  // Split by /upload/
  const parts = secureUrl.split('/upload/');
  if (parts.length !== 2) return secureUrl;

  const { w, h, c = 'fill' } = options;
  const transforms = ['q_auto', 'f_auto']; // automatically optimize quality and format (e.g. webp)
  
  if (w) transforms.push(`w_${w}`);
  if (h) transforms.push(`h_${h}`);
  if (w || h) transforms.push(`c_${c}`);

  return `${parts[0]}/upload/${transforms.join(',')}/${parts[1]}`;
}
