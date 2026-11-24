// Production stays on the portfolio path. A preview host can override it:
//   VITE_BASE=/ npm run build
const base = process.env.VITE_BASE || '/demos/qb-simulator/';

export default {
  base,
  server: {
    open: true
  }
}
