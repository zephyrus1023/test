(function() {
  const getDynamicBasePath = () => {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    if (hostname.endsWith('.github.io')) {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return '/' + segments[0];
      }
    }
    return '';
  };

  window.__AX_STATIC_CONFIG__ = {
    mode: "static",
    basePath: getDynamicBasePath(),
    repository: ""
  };
})();
