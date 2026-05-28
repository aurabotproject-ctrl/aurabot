// Simple hash-based router for static deployment
export const Router = {
  getPath(): string {
    return window.location.hash.replace('#', '') || '/';
  },

  navigate(path: string) {
    window.location.hash = path;
  },

  replace(path: string) {
    window.location.replace(window.location.pathname + window.location.search + '#' + path);
  },
};
