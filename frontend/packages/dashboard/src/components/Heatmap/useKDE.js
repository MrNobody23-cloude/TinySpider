export function computeKDE(points, width, height, bandwidth = 0.05) {
    const total = Math.max(1, width * height);
    const grid = new Array(total).fill(0);
    const sigma = Math.max(0.0001, bandwidth);
    let max = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const nx = width > 1 ? x / (width - 1) : 0;
            const ny = height > 1 ? y / (height - 1) : 0;
            let sum = 0;
            for (const point of points) {
                const dx = nx - point.x;
                const dy = ny - point.y;
                const dist2 = dx * dx + dy * dy;
                sum += (point.weight || 1) * Math.exp(-dist2 / (2 * sigma * sigma));
            }
            const idx = y * width + x;
            grid[idx] = sum;
            if (sum > max) max = sum;
        }
    }

    if (max <= 0) return grid;
    return grid.map((value) => Math.min(1, Math.max(0, value / max)));
}
