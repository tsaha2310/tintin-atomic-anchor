export class PolygonNavSystem {
    constructor(config = {}) {
        this.gridSize = config.gridSize || 10;
        this.mapMaxX = config.mapMaxX || 3100;
        this.mapMaxY = config.mapMaxY || 1200;
        this.horizonY = config.horizonY || 350;
        this.polygons = []; // Array of arrays containing {x, y} points
    }

    setObstacles(polygonArray) {
        this.polygons = polygonArray;
    }

    // Mathematical projection to find distance from point to a line segment
    _distanceToSegment(p, v, w) {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
        if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
        
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const projX = v.x + t * (w.x - v.x);
        const projY = v.y + t * (w.y - v.y);
        
        return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
    }

    // Ray-Casting algorithm to check if a point is strictly inside a polygon
    _isInsidePolygon(p, poly) {
        let isInside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            
            const intersect = ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    isWalkable(x, y, margin = 0) {
        if (y < this.horizonY) return false;

        const p = { x, y };

        for (const poly of this.polygons) {
            // 1. Is the point mathematically inside the polygon?
            if (this._isInsidePolygon(p, poly)) return false;

            // 2. Is the point too close to any of the polygon's edges?
            if (margin > 0) {
                for (let i = 0; i < poly.length; i++) {
                    const v = poly[i];
                    const w = poly[(i + 1) % poly.length]; // Wrap to start
                    if (this._distanceToSegment(p, v, w) < margin) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    hasLineOfSight(x1, y1, x2, y2, margin) {
        // Precise Ray-Marching using the new polygon logic
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.floor(dist / (this.gridSize * 1.5))); 
        
        for (let i = 1; i < steps; i++) {
            const rx = x1 + (x2 - x1) * (i / steps);
            const ry = y1 + (y2 - y1) * (i / steps);
            if (!this.isWalkable(rx, ry, margin)) return false;
        }
        return true;
    }

    findPath(startX, startY, targetX, targetY, margin = 5) {
        if (this.hasLineOfSight(startX, startY, targetX, targetY, margin)) {
            return [{x: startX, y: startY}, {x: targetX, y: targetY}];
        }

        const toCol = (x) => Math.floor(x / this.gridSize);
        const toRow = (y) => Math.floor(y / this.gridSize);
        const toX = (col) => col * this.gridSize + this.gridSize / 2;
        const toY = (row) => row * this.gridSize + this.gridSize / 2;

        const startNode = { c: toCol(startX), r: toRow(startY), g: 0, f: 0, parent: null };
        const endNode = { c: toCol(targetX), r: toRow(targetY) };
        
        const openList = [startNode];
        const openMap = new Map(); 
        openMap.set(`${startNode.c},${startNode.r}`, startNode);
        
        const closedSet = new Set();
        let iterations = 0;
        let closestNode = startNode;
        let minH = Infinity;

        while (openList.length > 0 && iterations < 8000) {
            iterations++;
            
            let minIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[minIndex].f) minIndex = i;
            }
            
            const current = openList[minIndex];
            const lastNode = openList.pop();
            if (minIndex !== openList.length) openList[minIndex] = lastNode;

            const currentKey = `${current.c},${current.r}`;
            openMap.delete(currentKey);

            if (current.c === endNode.c && current.r === endNode.r) {
                const path = [];
                let curr = current;
                while (curr) {
                    path.unshift({ x: toX(curr.c), y: toY(curr.r) });
                    curr = curr.parent;
                }
                path[0] = { x: startX, y: startY };
                path[path.length - 1] = { x: targetX, y: targetY };
                return this.smoothPath(path, margin);
            }

            closedSet.add(currentKey);

            const neighbors = [
                {dc: 0, dr: -1}, {dc: 0, dr: 1}, {dc: -1, dr: 0}, {dc: 1, dr: 0},
                {dc: -1, dr: -1}, {dc: 1, dr: -1}, {dc: -1, dr: 1}, {dc: 1, dr: 1}
            ];

            for (let n of neighbors) {
                const nc = current.c + n.dc;
                const nr = current.r + n.dr;
                const neighborKey = `${nc},${nr}`;

                if (closedSet.has(neighborKey)) continue;

                const nx = toX(nc);
                const ny = toY(nr);

                if (nx < 0 || nx > this.mapMaxX || ny < this.horizonY || ny > this.mapMaxY) continue;
                if (!this.isWalkable(nx, ny, margin)) continue;

                if (n.dc !== 0 && n.dr !== 0) {
                    if (!this.isWalkable(toX(current.c + n.dc), toY(current.r), margin) && 
                        !this.isWalkable(toX(current.c), toY(current.r + n.dr), margin)) {
                        continue;
                    }
                }

                const dx = Math.abs(nc - endNode.c);
                const dy = Math.abs(nr - endNode.r);
                const hCost = (dx > dy) ? (14 * dy + 10 * (dx - dy)) : (14 * dx + 10 * (dy - dx));
                const gCost = current.g + (n.dc === 0 || n.dr === 0 ? 10 : 14);
                const fCost = gCost + hCost;

                if (hCost < minH) {
                    minH = hCost;
                    closestNode = current;
                }

                const existing = openMap.get(neighborKey);
                if (existing) {
                    if (gCost < existing.g) {
                        existing.g = gCost;
                        existing.f = fCost;
                        existing.parent = current;
                    }
                } else {
                    const newNode = { c: nc, r: nr, g: gCost, f: fCost, parent: current };
                    openList.push(newNode);
                    openMap.set(neighborKey, newNode);
                }
            }
        }
        
        console.warn(`Pathfinder exhausted! Routing to closest node.`);
        const fallbackPath = [];
        let curr = closestNode;
        while (curr) {
            fallbackPath.unshift({ x: toX(curr.c), y: toY(curr.r) });
            curr = curr.parent;
        }
        fallbackPath[0] = { x: startX, y: startY };
        return this.smoothPath(fallbackPath, margin);
    }

    smoothPath(path, margin) {
        if (path.length <= 2) return path;
        const smoothed = [path[0]];
        let currentIdx = 0;
        
        while (currentIdx < path.length - 1) {
            let furthestVisible = currentIdx + 1;
            for (let i = path.length - 1; i > currentIdx + 1; i--) {
                if (this.hasLineOfSight(path[currentIdx].x, path[currentIdx].y, path[i].x, path[i].y, margin)) {
                    furthestVisible = i;
                    break;
                }
            }
            smoothed.push(path[furthestVisible]);
            currentIdx = furthestVisible;
        }
        return smoothed;
    }
}
