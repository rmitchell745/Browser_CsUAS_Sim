// Extracted from index.html.
// Map rendering is the main visual consumer of world snapshots and selected
// object state, so it is a likely seam for richer playback tooling later.
class MapRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.scenario = null;
        this.viewport = {
          zoom: 1,
          offsetX: 0,
          offsetY: 0
        };
        this.backgroundImage = null;
        this.isDragging = false;
        this.lastPointer = null;
        this.onViewportChange = null;
        this.selectedEntity = null;
        this.bindInteractions();
      }

      bindInteractions() {
        this.canvas.addEventListener("wheel", (event) => {
          event.preventDefault();
          const delta = event.deltaY < 0 ? 1.08 : 0.92;
          this.viewport.zoom = SIMULATION_KERNEL.clamp(this.viewport.zoom * delta, 0.65, 2.8);
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        });
        this.canvas.addEventListener("pointerdown", (event) => {
          this.isDragging = true;
          this.lastPointer = { x: event.clientX, y: event.clientY };
          this.canvas.setPointerCapture(event.pointerId);
        });
        this.canvas.addEventListener("pointermove", (event) => {
          if (!this.isDragging || !this.lastPointer) {
            return;
          }
          this.viewport.offsetX += event.clientX - this.lastPointer.x;
          this.viewport.offsetY += event.clientY - this.lastPointer.y;
          this.lastPointer = { x: event.clientX, y: event.clientY };
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        });
        const endDrag = (event) => {
          this.isDragging = false;
          this.lastPointer = null;
          if (event?.pointerId != null) {
            this.canvas.releasePointerCapture(event.pointerId);
          }
        };
        this.canvas.addEventListener("pointerup", endDrag);
        this.canvas.addEventListener("pointerleave", endDrag);
      }

      setScenario(scenario) {
        this.scenario = scenario || null;
        const src = this.scenario?.environment?.backgroundImageBase64 || "";
        if (!src) {
          this.backgroundImage = null;
          return;
        }
        const image = new Image();
        image.onload = () => {
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        };
        image.src = src;
        this.backgroundImage = image;
      }

      resetViewport() {
        this.viewport.zoom = 1;
        this.viewport.offsetX = 0;
        this.viewport.offsetY = 0;
      }

      setSelection(selection) {
        this.selectedEntity = selection || null;
      }

      getPixelsPerMeter() {
        const mapWidthMeters = Math.max(100, Number(this.scenario?.environment?.mapWidthMeters || 1080));
        return (this.width / mapWidthMeters) * this.viewport.zoom;
      }

      worldToCanvas(position) {
        const ppm = this.getPixelsPerMeter();
        return {
          x: (position.x * ppm) + this.viewport.offsetX,
          y: (position.y * ppm) + this.viewport.offsetY
        };
      }

      canvasToWorld(canvasPoint) {
        const ppm = this.getPixelsPerMeter();
        return {
          x: (canvasPoint.x - this.viewport.offsetX) / ppm,
          y: (canvasPoint.y - this.viewport.offsetY) / ppm,
          z: 0
        };
      }

      eventToCanvas(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / rect.width) * this.width,
          y: ((event.clientY - rect.top) / rect.height) * this.height
        };
      }

      hitTest(frame, event) {
        if (!frame) {
          return null;
        }
        const point = this.eventToCanvas(event);
        const candidates = [];
        (frame.objects || []).forEach((object) => {
          const canvasPoint = this.worldToCanvas({ x: object.x, y: object.y });
          candidates.push({
            type: "object",
            id: object.id,
            name: object.name,
            side: object.side,
            distancePx: Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y)
          });
        });
        (frame.tracks || []).forEach((track) => {
          if (track.x == null || track.y == null) {
            return;
          }
          const canvasPoint = this.worldToCanvas({ x: track.x, y: track.y });
          candidates.push({
            type: "track",
            id: track.id,
            name: track.id,
            side: "Blue",
            distancePx: Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y)
          });
        });
        return candidates
          .filter((candidate) => candidate.distancePx <= 24)
          .sort((left, right) => left.distancePx - right.distancePx)[0] || null;
      }

      draw(frame, report) {
        const ctx = this.context;
        ctx.clearRect(0, 0, this.width, this.height);
        this.drawTerrain(ctx);
        this.drawBackground(ctx);
        this.drawScale(ctx);
        if (!frame) {
          return;
        }

        frame.objects.forEach((object) => {
          if (object.side === "Blue") {
            this.drawBlueObject(ctx, object);
          } else {
            this.drawRedObject(ctx, object);
          }
        });

        frame.tracks.forEach((track) => {
          if (track.x === null || track.status === "Destroyed") {
            return;
          }
          this.drawTrack(ctx, track);
        });

        (frame.clutterPlaceholders || []).forEach((placeholder) => {
          this.drawClutterPlaceholder(ctx, placeholder);
        });

        this.drawSelection(ctx, frame);

        this.drawOverlay(ctx, frame, report);
      }

      drawSelection(ctx, frame) {
        if (!this.selectedEntity) {
          return;
        }
        const target = this.selectedEntity.type === "track"
          ? (frame.tracks || []).find((track) => track.id === this.selectedEntity.id)
          : (frame.objects || []).find((object) => object.id === this.selectedEntity.id);
        if (!target) {
          return;
        }
        const position = this.selectedEntity.type === "track"
          ? this.worldToCanvas({ x: target.x, y: target.y })
          : this.worldToCanvas({ x: target.x, y: target.y });
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      drawBackground(ctx) {
        if (!this.backgroundImage || !this.backgroundImage.complete) {
          return;
        }
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.drawImage(
          this.backgroundImage,
          this.viewport.offsetX,
          this.viewport.offsetY,
          this.width * this.viewport.zoom,
          this.height * this.viewport.zoom
        );
        ctx.restore();
      }

      drawTerrain(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, "rgba(63, 116, 138, 0.45)");
        gradient.addColorStop(0.55, "rgba(44, 86, 94, 0.26)");
        gradient.addColorStop(1, "rgba(68, 59, 37, 0.55)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= this.width; x += 90) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.height);
          ctx.stroke();
        }
        for (let y = 0; y <= this.height; y += 90) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.width, y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 220, 152, 0.08)";
        ctx.beginPath();
        ctx.moveTo(0, this.height * 0.82);
        ctx.lineTo(this.width * 0.22, this.height * 0.74);
        ctx.lineTo(this.width * 0.36, this.height * 0.85);
        ctx.lineTo(0, this.height);
        ctx.closePath();
        ctx.fill();

        (Array.isArray(this.scenario?.terrainObjects) ? this.scenario.terrainObjects : []).forEach((terrain) => {
          if (!terrain.areaPolygon || terrain.areaPolygon.length < 3) {
            return;
          }
          ctx.save();
          ctx.beginPath();
          terrain.areaPolygon.forEach((point, index) => {
            const canvasPoint = this.worldToCanvas(point);
            if (index === 0) {
              ctx.moveTo(canvasPoint.x, canvasPoint.y);
            } else {
              ctx.lineTo(canvasPoint.x, canvasPoint.y);
            }
          });
          ctx.closePath();
          if (terrain.interferenceType === "Noise") {
            ctx.fillStyle = "rgba(243, 180, 75, 0.16)";
            ctx.strokeStyle = "rgba(243, 180, 75, 0.75)";
            ctx.setLineDash([7, 5]);
          } else {
            ctx.fillStyle = "rgba(124, 214, 255, 0.15)";
            ctx.strokeStyle = "rgba(124, 214, 255, 0.72)";
          }
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          const centroid = terrain.areaPolygon.reduce((accumulator, point) => ({
            x: accumulator.x + point.x,
            y: accumulator.y + point.y
          }), { x: 0, y: 0 });
          const labelPoint = this.worldToCanvas({
            x: centroid.x / terrain.areaPolygon.length,
            y: centroid.y / terrain.areaPolygon.length
          });
          ctx.fillStyle = "#f7f0df";
          ctx.font = "12px Trebuchet MS";
          ctx.fillText(terrain.label, labelPoint.x + 8, labelPoint.y - 6);
          ctx.restore();
        });
      }

      drawScale(ctx) {
        const ppm = this.getPixelsPerMeter();
        const barMeters = 100;
        const barPixels = Math.max(24, barMeters * ppm);
        ctx.fillStyle = "rgba(10, 16, 20, 0.55)";
        ctx.fillRect(18, this.height - 42, barPixels, 18);
        ctx.fillStyle = "#f7f0df";
        ctx.fillRect(18, this.height - 42, barPixels / 2, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeRect(18, this.height - 42, barPixels, 18);
        ctx.fillStyle = "#f7f0df";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText("0", 18, this.height - 48);
        ctx.fillText(barMeters + "m", 18 + barPixels - 16, this.height - 48);
      }

      drawSector(ctx, position, rangeM, headingDeg, fovDeg, strokeStyle) {
        const center = this.worldToCanvas(position);
        const radius = Math.max(2, rangeM * this.getPixelsPerMeter());
        const start = (headingDeg - (fovDeg / 2)) * (Math.PI / 180);
        const end = (headingDeg + (fovDeg / 2)) * (Math.PI / 180);
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = strokeStyle.replace("0.22", "0.08");
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.arc(center.x, center.y, radius, start, end);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      drawRangeRing(ctx, position, rangeM, strokeStyle) {
        const center = this.worldToCanvas(position);
        const radius = Math.max(2, rangeM * this.getPixelsPerMeter());
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawBlueObject(ctx, object) {
        const worldPosition = { x: object.x, y: object.y };
        const position = this.worldToCanvas(worldPosition);
        if (object.isInterceptorChild) {
          ctx.save();
          ctx.fillStyle = "#7dffb1";
          ctx.beginPath();
          ctx.arc(position.x, position.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#eafff2";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        (object.sensors || []).forEach((sensor) => {
          if ((sensor.horizontalFovDeg || 360) >= 359) {
            this.drawRangeRing(ctx, worldPosition, sensor.maxRangeM, "rgba(89, 183, 207, 0.22)");
          } else {
            this.drawSector(ctx, worldPosition, sensor.maxRangeM, sensor.headingDeg || 0, sensor.horizontalFovDeg || 360, "rgba(89, 183, 207, 0.22)");
          }
        });
        (object.effectors || []).forEach((effector) => {
          this.drawRangeRing(ctx, worldPosition, effector.maxRangeM, "rgba(125, 255, 177, 0.24)");
        });

        ctx.fillStyle = "#59b7cf";
        ctx.beginPath();
        ctx.arc(position.x, position.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d9f2f8";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#d9f2f8";
        ctx.font = "bold 13px Trebuchet MS";
        ctx.fillText(object.name, position.x + 16, position.y - 10);
        ctx.restore();
      }

      drawRedObject(ctx, object) {
        const worldPosition = { x: object.x, y: object.y };
        const position = this.worldToCanvas(worldPosition);
        if (object.isInterceptorChild) {
          ctx.save();
          ctx.strokeStyle = "#ffe6dd";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(position.x, position.y - 6);
          ctx.lineTo(position.x + 6, position.y);
          ctx.lineTo(position.x, position.y + 6);
          ctx.lineTo(position.x - 6, position.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        ctx.fillStyle = object.destroyed ? "rgba(216, 91, 74, 0.35)" : "#d85b4a";
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - 12);
        ctx.lineTo(position.x + 14, position.y);
        ctx.lineTo(position.x, position.y + 12);
        ctx.lineTo(position.x - 14, position.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffd4c8";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (object.destroyed) {
          ctx.beginPath();
          ctx.moveTo(position.x - 16, position.y - 16);
          ctx.lineTo(position.x + 16, position.y + 16);
          ctx.moveTo(position.x + 16, position.y - 16);
          ctx.lineTo(position.x - 16, position.y + 16);
          ctx.stroke();
        }

        ctx.fillStyle = "#ffe6dd";
        ctx.font = "bold 13px Trebuchet MS";
        ctx.fillText(object.name, position.x + 16, position.y - 10);
        if (Number.isFinite(object.currentHeadingDeg)) {
          const headingRad = object.currentHeadingDeg * (Math.PI / 180);
          ctx.strokeStyle = "rgba(255, 212, 200, 0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(position.x, position.y);
          ctx.lineTo(position.x + (Math.cos(headingRad) * 36), position.y + (Math.sin(headingRad) * 36));
          ctx.stroke();
        }
        ctx.restore();
      }

      drawTrack(ctx, track) {
        const position = this.worldToCanvas({ x: track.x, y: track.y });
        ctx.save();
        if (track.status === "Dropped") {
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "rgba(214, 214, 214, 0.9)";
        } else {
          ctx.strokeStyle = "#ffcc71";
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - 11);
        ctx.lineTo(position.x + 11, position.y);
        ctx.lineTo(position.x, position.y + 11);
        ctx.lineTo(position.x - 11, position.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = track.status === "Dropped" ? "#d7d7d7" : "#ffcc71";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText(track.id, position.x + 14, position.y + 4);
        if (Number.isFinite(track.headingDeg)) {
          const headingRad = track.headingDeg * (Math.PI / 180);
          ctx.strokeStyle = "rgba(255, 204, 113, 0.85)";
          ctx.beginPath();
          ctx.moveTo(position.x, position.y);
          ctx.lineTo(position.x + (Math.cos(headingRad) * 24), position.y + (Math.sin(headingRad) * 24));
          ctx.stroke();
        }
        ctx.restore();
      }

      drawClutterPlaceholder(ctx, placeholder) {
        const position = this.worldToCanvas({ x: placeholder.centerX, y: placeholder.centerY });
        ctx.save();
        ctx.strokeStyle = "rgba(168, 85, 255, 0.48)";
        ctx.fillStyle = "rgba(80, 216, 255, 0.08)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(position.x, position.y, placeholder.radiusM * this.getPixelsPerMeter(), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#caa7ff";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText(placeholder.label || "Clutter Placeholder", position.x + 12, position.y - 10);
        ctx.restore();
      }

      drawOverlay(ctx, frame, report) {
        ctx.save();
        ctx.fillStyle = "rgba(12, 16, 20, 0.6)";
        ctx.fillRect(this.width - 280, 14, 262, 116);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.strokeRect(this.width - 280, 14, 262, 116);
        ctx.fillStyle = "#f7f0df";
        ctx.font = "bold 14px Trebuchet MS";
        ctx.fillText("Timeline Snapshot", this.width - 262, 36);
        ctx.font = "13px Trebuchet MS";
        ctx.fillText("Scenario: " + escapeHtml(report?.scenarioName || "Preview"), this.width - 262, 58);
        ctx.fillText("Time: " + SIMULATION_KERNEL.round(frame.timeSec, 2) + " s", this.width - 262, 78);
        ctx.fillText("Tracks: " + frame.tracks.length, this.width - 262, 98);
        ctx.fillText("Destroyed: " + (report && report.targetDestroyed ? "Yes" : "No"), this.width - 262, 118);
        ctx.restore();
      }
    }
