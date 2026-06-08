// MathJax 3 configuration for blog posts that opt into math rendering.
// Loaded only on posts whose front matter sets `math: true`.
// Kramdown's math engine is disabled in _config.yml so $...$ and $$...$$
// reach the rendered HTML verbatim; MathJax scans for those delimiters here.
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
};
