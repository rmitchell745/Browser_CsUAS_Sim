// Extracted from index.html
class AppController {
      constructor() {
        this.kernel = SIMULATION_KERNEL;
        this.uiManager = new UIManager();
        this.simulationManager = new this.kernel.SimulationManager();
        this.monteCarloManager = new this.kernel.MonteCarloManager(this.simulationManager);
        this.renderer = new MapRenderer(document.getElementById("sim-canvas"));
        this.renderer.onViewportChange = () => this.renderCurrentView();
        this.state = {
          currentScenario: this.kernel.buildDemoScenario(),
          currentScenarioSource: "demo",
          singleRun: null,
          monteCarloRows: [],
          currentFrame: null,
          currentReport: null,
          playbackTimer: null,
          monteCarloWorker: null,
          selectedTemplateId: null,
          templateEditorSensors: [],
          templateEditorEffectors: [],
          activeTemplateSensorIndex: 0,
          activeTemplateEffectorIndex: 0,
          templateJsonDirty: false,
          templateSearch: "",
          exportTab: "scenario",
          exportPrettyJson: true,
          scenarioExportSource: "normalized",
          originalScenarioPayloadText: "",
          wizardBlueAssets: [],
          wizardThreatGroups: [],
          activeWizardBlueAssetId: null,
          activeWizardThreatGroupId: null,
          mapInteraction: null,
          selectedMapEntity: null,
          nextWizardBlueAssetId: 1,
          nextWizardThreatGroupId: 1,
          lastImportSummary: {
            source: "Built-in baseline",
            templateCount: 0,
            instanceCount: 0,
            normalizedChanged: false,
            dirty: false
          }
        };
        this.bindEvents();
        this.applyQueryParams();
        this.renderer.setScenario(this.state.currentScenario);
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.loadWizardGeneratorPattern("blank-scratch");
        this.updateScenarioLabel();
        this.syncPlaceholderControls();
        this.clearResults();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.renderWizardBlueAssets();
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderSelectedObjectEditor();
        this.refreshExportPreview();
        this.updateMapSelectionChip();
        this.handleAutorun();
      }

      bindEvents() {
        document.querySelectorAll(".nav-button").forEach((button) => {
          button.addEventListener("click", () => {
            this.uiManager.showScreen(button.dataset.screen);
          });
        });

        document.getElementById("new-scenario-btn").addEventListener("click", () => {
          this.resetToBaselineScenario();
        });
        document.getElementById("open-scenario-sidebar-btn").addEventListener("click", () => {
          this.uiManager.showScreen("wizard");
        });
        document.getElementById("open-scenario-builder-inline-btn").addEventListener("click", () => {
          this.uiManager.showScreen("wizard");
        });
        document.getElementById("open-roster-inline-btn").addEventListener("click", () => {
          this.uiManager.showScreen("wizard");
          document.getElementById("wizard-roster-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        document.getElementById("load-scenario-header-btn").addEventListener("click", () => {
          document.getElementById("scenario-file-input").click();
        });
        document.getElementById("save-scenario-btn").addEventListener("click", () => {
          this.exportCurrentScenario();
        });
        document.getElementById("open-template-sidebar-btn").addEventListener("click", () => {
          this.uiManager.showScreen("templates");
        });
        document.getElementById("open-template-library-inline-btn").addEventListener("click", () => {
          this.uiManager.showScreen("templates");
        });
        document.getElementById("open-analysis-sidebar-btn").addEventListener("click", () => {
          this.uiManager.showScreen("report");
        });
        document.getElementById("open-analysis-inline-btn").addEventListener("click", () => {
          this.uiManager.showScreen("report");
        });
        document.getElementById("open-export-sidebar-btn").addEventListener("click", () => {
          this.uiManager.showScreen("export");
        });
        document.getElementById("open-tutorial-btn").addEventListener("click", () => {
          console.log("Tutorial placeholder");
          this.setStatus("Tutorial placeholder");
        });
        document.getElementById("add-instance-btn").addEventListener("click", () => {
          this.addRosterInstance();
        });
        document.getElementById("run-monte-carlo-header-btn").addEventListener("click", () => {
          this.runMonteCarlo();
        });
        document.getElementById("zoom-reset-btn").addEventListener("click", () => {
          this.renderer.resetViewport();
          this.renderCurrentView();
          this.setStatus("Map viewport reset");
        });
        document.querySelectorAll("[data-close-sidebar]").forEach((button) => {
          button.addEventListener("click", () => {
            this.uiManager.closePanels();
          });
        });

        document.getElementById("run-single-btn").addEventListener("click", () => {
          this.runSingleScenario();
        });

        document.getElementById("run-monte-carlo-btn").addEventListener("click", () => {
          this.runMonteCarlo();
        });

        document.getElementById("load-scenario-btn").addEventListener("click", () => {
          document.getElementById("scenario-file-input").click();
        });

        document.getElementById("scenario-file-input").addEventListener("change", (event) => {
          this.importScenarioFile(event);
        });

        document.getElementById("wizard-load-demo-btn").addEventListener("click", () => {
          this.loadDemoScenario();
        });

        document.getElementById("wizard-load-scratch-btn").addEventListener("click", () => {
          this.loadScratchScenario();
        });

        document.getElementById("wizard-load-preset-btn").addEventListener("click", () => {
          this.loadWizardGeneratorPattern(document.getElementById("wizard-preset").value);
          this.refreshWizardSummary();
          this.setStatus("Generator pattern loaded");
        });

        document.getElementById("wizard-preview-btn").addEventListener("click", () => {
          this.refreshWizardSummary();
          this.setStatus("Scenario editor preview refreshed");
        });

        document.getElementById("wizard-build-btn").addEventListener("click", () => {
          this.generateScenarioFromWizard();
        });

        document.getElementById("wizard-add-threat-group-btn").addEventListener("click", () => {
          this.addWizardThreatGroup();
        });
        document.getElementById("wizard-add-blue-asset-btn").addEventListener("click", () => {
          this.addWizardBlueAsset();
        });
        document.querySelectorAll(".wizard-jump-btn").forEach((button) => {
          button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.wizardTarget || "");
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
        });

        document.getElementById("map-width-input").addEventListener("input", (event) => {
          this.state.currentScenario.environment.mapWidthMeters = Number(event.target.value || 1080);
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
        });
        document.getElementById("map-background-upload-btn").addEventListener("click", () => {
          document.getElementById("map-background-input").click();
        });
        document.getElementById("map-background-input").addEventListener("change", (event) => {
          this.importMapBackground(event);
        });
        document.getElementById("clear-map-background-btn").addEventListener("click", () => {
          this.state.currentScenario.environment.backgroundImageBase64 = "";
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
          this.setStatus("Map background cleared");
        });
        document.getElementById("add-block-terrain-btn").addEventListener("click", () => {
          this.addTerrainObject("Block");
        });
        document.getElementById("add-noise-terrain-btn").addEventListener("click", () => {
          this.addTerrainObject("Noise");
        });
        document.getElementById("add-network-btn").addEventListener("click", () => {
          this.addNetwork();
        });
        document.getElementById("add-power-grid-btn").addEventListener("click", () => {
          this.addPowerGrid();
        });

        [
          "wizard-scenario-name",
          "wizard-scenario-description",
          "map-width-input",
          "wizard-ghost-enabled",
          "wizard-clutter-enabled",
          "wizard-preset"
        ].forEach((id) => {
          document.getElementById(id).addEventListener("input", () => {
            this.refreshWizardSummary();
          });
          document.getElementById(id).addEventListener("change", () => {
            this.refreshWizardSummary();
          });
        });

        document.getElementById("export-scenario-btn").addEventListener("click", () => {
          this.exportCurrentScenario();
        });

        document.getElementById("export-scenario-file-btn").addEventListener("click", () => {
          this.exportCurrentScenario();
        });

        document.getElementById("reset-view-btn").addEventListener("click", () => {
          this.stopPlayback();
          this.renderScenarioSnapshot();
          this.setPlaybackStatus("Idle");
          this.setStatus("Scenario preview reset");
        });

        document.getElementById("export-single-btn").addEventListener("click", () => {
          if (!this.state.singleRun) {
            return;
          }
          this.state.exportTab = "report";
          const csv = this.kernel.rowsToCsv([this.kernel.createCsvRow(1, this.state.singleRun.report)]);
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.singleRun.report.scenarioName) + "_single_run.csv", csv, "text/csv;charset=utf-8");
        });

        document.getElementById("export-monte-carlo-btn").addEventListener("click", () => {
          if (!this.state.monteCarloRows.length) {
            return;
          }
          this.state.exportTab = "monteCarlo";
          const csv = this.kernel.rowsToCsv(this.state.monteCarloRows);
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.currentScenario.metadata.name) + "_monte_carlo.csv", csv, "text/csv;charset=utf-8");
        });

        document.getElementById("export-log-btn").addEventListener("click", () => {
          if (!this.state.singleRun) {
            return;
          }
          const json = JSON.stringify(this.state.singleRun.report.logs, null, 2);
          this.state.exportTab = "eventLog";
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.singleRun.report.scenarioName) + "_event_log.json", json, "application/json;charset=utf-8");
        });

        document.querySelectorAll("[data-export-tab]").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.exportTab = button.dataset.exportTab;
            this.refreshExportPreview();
          });
        });

        document.getElementById("scenario-export-source").addEventListener("change", (event) => {
          this.state.scenarioExportSource = event.target.value;
          this.refreshExportPreview();
        });

        document.getElementById("export-pretty-toggle").addEventListener("change", (event) => {
          this.state.exportPrettyJson = !!event.target.checked;
          this.refreshExportPreview();
        });

        document.getElementById("copy-export-preview-btn").addEventListener("click", async () => {
          try {
            await copyTextToClipboard(document.getElementById("export-preview").value);
            this.setStatus("Export preview copied");
          } catch (error) {
            this.setStatus("Copy failed");
          }
        });

        document.getElementById("template-search").addEventListener("input", (event) => {
          this.state.templateSearch = event.target.value || "";
          this.renderTemplateBuilder();
        });

        document.getElementById("create-template-btn").addEventListener("click", () => {
          this.createTemplateFromPreset(document.getElementById("new-template-preset").value);
        });

        document.getElementById("save-template-form-btn").addEventListener("click", () => {
          this.saveSelectedTemplateForm();
        });

        document.getElementById("duplicate-template-btn").addEventListener("click", () => {
          this.duplicateSelectedTemplate();
        });

        document.getElementById("delete-template-btn").addEventListener("click", () => {
          this.deleteSelectedTemplate();
        });

        document.getElementById("apply-template-json-btn").addEventListener("click", () => {
          this.applyTemplateJsonEditor();
        });
        document.getElementById("export-selected-template-btn").addEventListener("click", () => {
          this.exportSelectedTemplate();
        });
        document.getElementById("import-template-btn").addEventListener("click", () => {
          document.getElementById("template-file-input").click();
        });
        document.getElementById("template-file-input").addEventListener("change", (event) => {
          this.importTemplateFile(event);
        });
        document.getElementById("template-json-editor").addEventListener("input", () => {
          this.state.templateJsonDirty = true;
        });
        document.getElementById("template-helper-static-asset-btn").addEventListener("click", () => {
          this.applyTemplateHelper("static-asset");
        });
        document.getElementById("template-helper-mobile-uas-btn").addEventListener("click", () => {
          this.applyTemplateHelper("mobile-uas");
        });
        document.getElementById("template-helper-add-radar-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-radar");
        });
        document.getElementById("template-helper-add-interceptor-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-interceptor");
        });
        document.getElementById("template-helper-add-jammer-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-jammer");
        });
        document.getElementById("add-template-sensor-btn").addEventListener("click", () => {
          this.addTemplateSensor();
        });
        document.getElementById("duplicate-template-sensor-btn").addEventListener("click", () => {
          this.duplicateTemplateSensor();
        });
        document.getElementById("remove-template-sensor-btn").addEventListener("click", () => {
          this.removeTemplateSensor();
        });
        document.getElementById("add-template-effector-btn").addEventListener("click", () => {
          this.addTemplateEffector();
        });
        document.getElementById("duplicate-template-effector-btn").addEventListener("click", () => {
          this.duplicateTemplateEffector();
        });
        document.getElementById("remove-template-effector-btn").addEventListener("click", () => {
          this.removeTemplateEffector();
        });
        [
          "template-sensor-enabled",
          "template-sensor-id-input",
          "template-sensor-name-input",
          "template-sensor-type-input",
          "template-sensor-range-input",
          "template-sensor-heading-input",
          "template-sensor-hfov-input",
          "template-sensor-vfov-input",
          "template-sensor-scan-input",
          "template-sensor-threshold-input",
          "template-sensor-transmit-input",
          "template-sensor-noise-floor-input",
          "template-sensor-noise-sigma-input",
          "template-sensor-classify-accuracy-input",
          "template-sensor-identify-accuracy-input"
        ].forEach((id) => {
          const element = document.getElementById(id);
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            this.updateTemplateSensorDraftFromForm();
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              this.updateTemplateSensorDraftFromForm();
            });
          }
        });
        [
          "template-effector-enabled",
          "template-effector-id-input",
          "template-effector-name-input",
          "template-effector-type-input",
          "template-effector-guidance-input",
          "template-effector-range-input",
          "template-effector-basepk-input",
          "template-effector-basepe-input",
          "template-effector-damage-input",
          "template-effector-ammo-input",
          "template-effector-slew-input",
          "template-effector-cooldown-input",
          "template-effector-speed-input",
          "template-effector-terminal-radius-input",
          "template-effector-flight-time-input",
          "template-effector-effect-duration-input",
          "template-effector-jam-strength-input",
          "template-effector-domains-input"
        ].forEach((id) => {
          const element = document.getElementById(id);
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            this.updateTemplateEffectorDraftFromForm();
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              this.updateTemplateEffectorDraftFromForm();
            });
          }
        });

        document.getElementById("ghost-placeholder-toggle").addEventListener("change", (event) => {
          this.state.currentScenario.environment.placeholderGhostTrack.enabled = event.target.checked;
          this.syncPlaceholderCards();
          this.refreshValidationSummary();
          this.refreshWizardSummary();
          this.refreshExportPreview();
          this.renderScenarioSnapshot();
          this.setStatus("Ghost placeholder " + (event.target.checked ? "enabled" : "disabled"));
        });

        document.getElementById("clutter-placeholder-toggle").addEventListener("change", (event) => {
          this.state.currentScenario.environment.placeholderClutterField.enabled = event.target.checked;
          this.syncPlaceholderCards();
          this.refreshValidationSummary();
          this.refreshWizardSummary();
          this.refreshExportPreview();
          this.renderScenarioSnapshot();
          this.setStatus("Clutter placeholder " + (event.target.checked ? "enabled" : "disabled"));
        });

        this.renderer.canvas.addEventListener("click", (event) => {
          this.handleMapClick(event);
        });
      }

      resetToBaselineScenario() {
        this.loadDemoScenario();
        this.loadWizardGeneratorPattern("blank-scratch");
        this.uiManager.closePanels();
        this.setStatus("Demo scenario loaded");
      }

      loadDemoScenario() {
        this.state.currentScenario = this.kernel.deepClone(this.kernel.buildDemoScenario());
        this.state.currentScenarioSource = "demo";
        this.state.originalScenarioPayloadText = "";
        this.state.scenarioExportSource = "normalized";
        this.state.lastImportSummary = {
          source: "Built-in demo",
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          normalizedChanged: false,
          dirty: false
        };
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.renderer.setScenario(this.state.currentScenario);
        this.updateScenarioLabel();
        this.syncPlaceholderControls();
        this.clearResults();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.renderWizardBlueAssets();
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderSelectedObjectEditor();
        this.refreshExportPreview();
      }

      loadScratchScenario() {
        this.state.currentScenario = this.kernel.deepClone(this.kernel.buildScratchScenario());
        this.state.currentScenarioSource = "scratch";
        this.state.originalScenarioPayloadText = "";
        this.state.scenarioExportSource = "normalized";
        this.state.lastImportSummary = {
          source: "Built-in scratch",
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          normalizedChanged: false,
          dirty: false
        };
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.renderer.setScenario(this.state.currentScenario);
        this.updateScenarioLabel();
        this.syncPlaceholderControls();
        this.clearResults();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.renderWizardBlueAssets();
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderSelectedObjectEditor();
        this.refreshExportPreview();
      }

      async importMapBackground(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("Map load failed"));
            reader.readAsDataURL(file);
          });
          this.state.currentScenario.environment.backgroundImageBase64 = String(dataUrl || "");
          this.renderer.setScenario(this.state.currentScenario);
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
          this.setStatus("Map background loaded");
        } catch (error) {
          this.setStatus("Map background load failed");
        } finally {
          event.target.value = "";
        }
      }

      exportSelectedTemplate() {
        const template = this.state.currentScenario.templates.find((candidate) => candidate.id === this.state.selectedTemplateId);
        if (!template) {
          this.setStatus("Select a template first");
          return;
        }
        const draftSnapshot = this.buildTemplateDraftSnapshot(template);
        downloadText(buildSafeFileStem(draftSnapshot.id) + ".json", JSON.stringify(draftSnapshot, null, 2), "application/json;charset=utf-8");
        this.setStatus("Template exported");
      }

      async importTemplateFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const template = this.kernel.normalizeScenario({
            metadata: { name: "Template import wrapper" },
            templates: [parsed],
            instances: []
          }).templates[0];
          const existingIndex = this.state.currentScenario.templates.findIndex((candidate) => candidate.id === template.id);
          if (existingIndex >= 0) {
            this.state.currentScenario.templates[existingIndex] = template;
          } else {
            this.state.currentScenario.templates.push(template);
          }
          this.state.selectedTemplateId = template.id;
          this.renderTemplateBuilder();
          this.refreshValidationSummary();
          this.refreshExportPreview();
          this.setStatus("Template imported");
        } catch (error) {
          this.setStatus("Template import failed");
        } finally {
          event.target.value = "";
        }
      }

      renderCurrentView() {
        if (this.state.currentFrame && this.state.currentReport) {
          this.renderer.draw(this.state.currentFrame, this.state.currentReport);
          return;
        }
        this.renderScenarioSnapshot();
      }

      updateMapSelectionChip() {
        const chip = document.getElementById("map-selection-chip");
        if (this.state.mapInteraction) {
          const modeLabels = {
            "blue-asset-position": "Placing Blue asset",
            "group-start": "Placing Red start",
            "group-end": "Placing Red end",
            "selected-object-move": "Moving selected object",
            "terrain-draw": "Drawing terrain polygon"
          };
          chip.textContent = modeLabels[this.state.mapInteraction.mode] || "Map interaction active";
          return;
        }
        if (!this.state.selectedMapEntity) {
          chip.textContent = "No map selection";
          return;
        }
        chip.textContent = this.state.selectedMapEntity.name + " selected";
      }

      handleMapClick(event) {
        const canvasPoint = this.renderer.eventToCanvas(event);
        const worldPoint = this.renderer.canvasToWorld(canvasPoint);
        if (this.state.mapInteraction) {
          if (this.state.mapInteraction.mode === "blue-asset-position") {
            const asset = this.state.wizardBlueAssets.find((item) => item.localId === this.state.mapInteraction.blueAssetId);
            if (asset) {
              asset.posX = this.kernel.round(worldPoint.x, 1);
              asset.posY = this.kernel.round(worldPoint.y, 1);
              this.state.activeWizardBlueAssetId = asset.localId;
            }
            this.state.mapInteraction = null;
            this.renderWizardBlueAssets();
            this.refreshWizardSummary();
            this.renderScenarioSnapshot();
            this.setStatus("Blue asset position updated from map");
            this.updateMapSelectionChip();
            return;
          }
          const group = this.state.wizardThreatGroups.find((item) => item.localId === this.state.mapInteraction.threatGroupId);
          if (group) {
            if (this.state.mapInteraction.mode === "group-start") {
              group.startX = this.kernel.round(worldPoint.x, 1);
              group.startY = this.kernel.round(worldPoint.y, 1);
            } else if (this.state.mapInteraction.mode === "group-end") {
              group.endX = this.kernel.round(worldPoint.x, 1);
              group.endY = this.kernel.round(worldPoint.y, 1);
            }
            this.state.activeWizardThreatGroupId = group.localId;
            this.state.mapInteraction = null;
            this.renderWizardThreatGroups();
            this.refreshWizardSummary();
            this.renderScenarioSnapshot();
            this.setStatus("Threat-group route updated from map");
            this.updateMapSelectionChip();
            return;
          }
          if (this.state.mapInteraction.mode === "selected-object-move") {
            const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === this.state.mapInteraction.instanceId);
            if (instance) {
              instance.posX = this.kernel.round(worldPoint.x, 1);
              instance.posY = this.kernel.round(worldPoint.y, 1);
              this.state.mapInteraction = null;
              this.updateScenarioState("Moved selected object");
              this.updateMapSelectionChip();
              return;
            }
          }
          if (this.state.mapInteraction.mode === "terrain-draw") {
            const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === this.state.mapInteraction.terrainId);
            if (terrain) {
              terrain.areaPolygon.push({
                x: this.kernel.round(worldPoint.x, 1),
                y: this.kernel.round(worldPoint.y, 1)
              });
              this.renderTerrainEditor();
              this.renderScenarioSnapshot();
              this.refreshExportPreview();
              this.setStatus("Terrain vertex added");
              return;
            }
          }
        }

        const hit = this.renderer.hitTest(this.state.currentFrame, event);
        this.state.selectedMapEntity = hit ? {
          type: hit.type,
          id: hit.id,
          name: hit.name,
          side: hit.side
        } : null;
        this.renderer.setSelection(this.state.selectedMapEntity);
        this.renderCurrentView();
        this.updateMapSelectionChip();
        this.renderSelectedObjectEditor();
      }

      setBusy(isBusy) {
        [
          "new-scenario-btn",
          "open-scenario-sidebar-btn",
          "load-scenario-header-btn",
          "save-scenario-btn",
          "open-template-sidebar-btn",
          "open-analysis-sidebar-btn",
          "open-export-sidebar-btn",
          "run-monte-carlo-header-btn",
          "run-single-btn",
          "run-monte-carlo-btn",
          "load-scenario-btn",
          "export-scenario-btn",
          "reset-view-btn",
          "zoom-reset-btn",
          "open-scenario-builder-inline-btn",
          "open-template-library-inline-btn",
          "open-analysis-inline-btn",
          "open-roster-inline-btn",
          "wizard-load-preset-btn",
          "wizard-preview-btn",
          "wizard-build-btn",
          "create-template-btn",
          "save-template-form-btn",
          "duplicate-template-btn",
          "delete-template-btn",
          "export-selected-template-btn",
          "import-template-btn",
          "apply-template-json-btn",
          "add-block-terrain-btn",
          "add-noise-terrain-btn",
          "add-instance-btn",
          "add-network-btn",
          "add-power-grid-btn",
          "copy-export-preview-btn",
          "export-single-btn",
          "export-monte-carlo-btn",
          "export-log-btn",
          "export-scenario-file-btn"
        ].forEach((id) => {
          document.getElementById(id).disabled = isBusy;
        });
      }

      setStatus(text) {
        document.getElementById("status-text").textContent = text;
      }

      setPlaybackStatus(text) {
        document.getElementById("playback-text").textContent = text;
      }

      updateScenarioLabel() {
        document.getElementById("scenario-text").textContent = this.state.currentScenario.metadata.name;
      }

      applyQueryParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("ghostPlaceholder") === "1") {
          this.state.currentScenario.environment.placeholderGhostTrack.enabled = true;
        }
        if (params.get("clutterPlaceholder") === "1") {
          this.state.currentScenario.environment.placeholderClutterField.enabled = true;
        }
      }

      handleAutorun() {
        const params = new URLSearchParams(window.location.search);
        const autorun = params.get("autorun");
        if (autorun === "single") {
          window.setTimeout(() => {
            this.runSingleScenario();
          }, 60);
        } else if (autorun === "montecarlo") {
          const iterations = Number(params.get("iterations"));
          if (Number.isFinite(iterations) && iterations > 0) {
            document.getElementById("monte-carlo-count").value = String(Math.min(250, iterations));
          }
          window.setTimeout(() => {
            this.runMonteCarlo();
          }, 60);
        }
      }

      syncPlaceholderControls() {
        document.getElementById("ghost-placeholder-toggle").checked = !!this.state.currentScenario.environment.placeholderGhostTrack?.enabled;
        document.getElementById("clutter-placeholder-toggle").checked = !!this.state.currentScenario.environment.placeholderClutterField?.enabled;
        this.syncPlaceholderCards();
      }

      syncPlaceholderCards() {
        const ghost = this.state.currentScenario.environment.placeholderGhostTrack;
        const clutter = this.state.currentScenario.environment.placeholderClutterField;
        document.getElementById("ghost-placeholder-card").textContent = ghost.enabled
          ? (ghost.label || "Ghost Track Placeholder") + " active at T+" + ghost.spawnTimeSec + "s"
          : "Ghost placeholder inactive";
        document.getElementById("clutter-placeholder-card").textContent = clutter.enabled
          ? (clutter.label || "Clutter Placeholder") + " active around (" + clutter.centerX + ", " + clutter.centerY + ")"
          : "Clutter placeholder inactive";
      }

      buildUniqueId(baseId, existingIds) {
        const safeBase = String(baseId || "Item").replace(/[^A-Za-z0-9_-]+/g, "-") || "Item";
        let candidate = safeBase;
        let index = 2;
        while (existingIds.has(candidate)) {
          candidate = safeBase + "-" + index;
          index += 1;
        }
        return candidate;
      }

      getTemplateById(templateId) {
        return this.state.currentScenario.templates.find((template) => template.id === templateId) || null;
      }

      ensureSelectedTemplate() {
        const templates = this.state.currentScenario.templates;
        if (!templates.length) {
          this.state.selectedTemplateId = null;
          return null;
        }
        const existing = this.getTemplateById(this.state.selectedTemplateId);
        if (existing) {
          return existing;
        }
        this.state.selectedTemplateId = templates[0].id;
        return templates[0];
      }

      getTemplateUsage(templateId) {
        return this.state.currentScenario.instances.filter((instance) => instance.templateId === templateId);
      }

      syncWizardTemplateRefs(oldTemplateId, newTemplateId) {
        if (!oldTemplateId || !newTemplateId || oldTemplateId === newTemplateId) {
          return;
        }
        const oldRef = "template:" + oldTemplateId;
        const newRef = "template:" + newTemplateId;
        this.state.wizardBlueAssets.forEach((asset) => {
          if (asset.templateRef === oldRef) {
            asset.templateRef = newRef;
          }
        });
        this.state.wizardThreatGroups.forEach((group) => {
          if (group.templateRef === oldRef) {
            group.templateRef = newRef;
          }
        });
      }

      getWizardTemplateBindingUsage(templateId) {
        const templateRef = "template:" + templateId;
        const usage = [];
        this.state.wizardBlueAssets.forEach((asset, index) => {
          if (asset.templateRef === templateRef) {
            usage.push({
              kind: "Blue asset",
              name: asset.name || ("Blue Asset " + (index + 1))
            });
          }
        });
        this.state.wizardThreatGroups.forEach((group, index) => {
          if (group.templateRef === templateRef) {
            usage.push({
              kind: "Threat group",
              name: group.name || group.templateName || ("Threat Group " + (index + 1))
            });
          }
        });
        return usage;
      }

      buildTemplateDraftSnapshot(template, options = {}) {
        if (!template) {
          return null;
        }
        this.updateTemplateSensorDraftFromForm();
        this.updateTemplateEffectorDraftFromForm();
        const currentTemplateId = template.id || "Template";
        const requestedTemplateId = document.getElementById("template-id-input").value.trim() || currentTemplateId;
        const existingIds = new Set(
          this.state.currentScenario.templates
            .map((item) => item.id)
            .filter((id) => id !== currentTemplateId)
        );
        const nextTemplateId = options.enforceUniqueId
          ? this.buildUniqueId(requestedTemplateId, existingIds)
          : requestedTemplateId;
        const roles = document.getElementById("template-roles-input").value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const c2Enabled = document.getElementById("template-c2-enabled").checked;
        const firstC2 = template.components?.c2 || {};
        const draft = this.kernel.deepClone(template);
        draft.id = nextTemplateId;
        draft.name = document.getElementById("template-name-input").value.trim() || nextTemplateId;
        draft.category = document.getElementById("template-category-input").value.trim() || "Generic";
        draft.defaultRoles = roles;
        draft.components = draft.components || {};
        draft.components.health = draft.components.health || {};
        draft.components.resistance = draft.components.resistance || {};
        draft.components.signature = draft.components.signature || {};
        draft.components.vulnerability = draft.components.vulnerability || {};
        draft.components.payload = draft.components.payload || {};
        draft.components.capability = draft.components.capability || {};
        draft.components.health.maxHealth = Number(document.getElementById("template-health-input").value || 0);
        draft.components.health.assetValuePts = Number(document.getElementById("template-asset-value-input").value || 0);
        draft.components.health.isHQ = document.getElementById("template-ishq-input").checked;
        draft.components.resistance.kineticResistance = Number(document.getElementById("template-resistance-input").value || 0);
        draft.components.resistance.ewResistance = Number(document.getElementById("template-ew-resistance-input").value || 0);
        draft.components.resistance.networkResistance = Number(document.getElementById("template-network-resistance-input").value || 0);
        draft.components.signature.radarSignatureDb = Number(document.getElementById("template-signature-input").value || 0);
        draft.components.signature.acousticSignatureDb = Number(document.getElementById("template-acoustic-signature-input").value || 60);
        draft.components.signature.rfEmissionDb = Number(document.getElementById("template-rf-signature-input").value || 20);
        draft.components.vulnerability.commsResilience = Number(document.getElementById("template-comms-resilience-input").value || 0);
        draft.components.vulnerability.navResilience = Number(document.getElementById("template-nav-resilience-input").value || 0);
        draft.components.vulnerability.cyberResilience = Number(document.getElementById("template-cyber-resilience-input").value || 0);
        draft.components.payload.impactDamagePoints = Number(document.getElementById("template-impact-damage-input").value || 0);
        draft.components.payload.selfDestructOnImpact = document.getElementById("template-self-destruct-input").checked;
        draft.components.capability.usesNetwork = document.getElementById("template-uses-network-input").checked;
        draft.components.capability.usesRF = document.getElementById("template-uses-rf-input").checked;
        draft.components.capability.requiresC2 = document.getElementById("template-requires-c2-input").checked;
        draft.components.capability.canOperateAutonomously = document.getElementById("template-autonomy-input").checked;
        draft.components.capability.lostLinkBehavior = document.getElementById("template-lost-link-behavior-input").value || "ContinueDeadReckoning";
        draft.components.powerConsumer = draft.components.powerConsumer || {};
        draft.components.powerConsumer.powerConsumedKw = Number(document.getElementById("template-power-consumed-input").value || 0);
        draft.components.movement = document.getElementById("template-movement-enabled").checked ? {
          speedMps: Number(document.getElementById("template-speed-input").value || 0),
          stepSec: Number(document.getElementById("template-step-input").value || 1),
          waypointToleranceM: Number(document.getElementById("template-waypoint-tolerance-input").value || 10)
        } : null;
        draft.components.sensors = this.kernel.deepClone(this.state.templateEditorSensors || []);
        draft.components.effectors = this.kernel.deepClone(this.state.templateEditorEffectors || []);
        draft.components.c2 = c2Enabled ? {
          trackCapacity: Number(document.getElementById("template-c2-capacity-input").value || firstC2.trackCapacity || 0),
          processingLatencySec: Number(document.getElementById("template-c2-latency-input").value || firstC2.processingLatencySec || 0.25)
        } : null;
        return this.kernel.normalizeScenario({
          metadata: { name: "Template Draft Snapshot" },
          templates: [draft],
          instances: []
        }).templates[0];
      }

      syncTemplateJsonEditorFromDraft(force = false) {
        const editor = document.getElementById("template-json-editor");
        if (!editor) {
          return;
        }
        if (!force && this.state.templateJsonDirty) {
          return;
        }
        const template = this.ensureSelectedTemplate();
        if (!template) {
          editor.value = "";
          this.state.templateJsonDirty = false;
          return;
        }
        const draftSnapshot = this.buildTemplateDraftSnapshot(template);
        editor.value = JSON.stringify(draftSnapshot, null, 2);
        this.state.templateJsonDirty = false;
      }

      selectTemplate(templateId, screenId = null) {
        if (!this.getTemplateById(templateId)) {
          return;
        }
        this.state.selectedTemplateId = templateId;
        this.renderTemplateBuilder();
        if (screenId) {
          this.uiManager.showScreen(screenId);
        }
      }

      refreshImportSummary() {
        const summary = this.state.lastImportSummary || {};
        const container = document.getElementById("import-summary");
        const cards = [
          { label: "Source", value: summary.source || "Built-in baseline" },
          { label: "Templates", value: this.state.currentScenario.templates.length },
          { label: "Instances", value: this.state.currentScenario.instances.length },
          { label: "Normalized", value: summary.normalizedChanged ? "Adjusted" : "No change" },
          { label: "Dirty", value: summary.dirty ? "Edited in UI" : "Clean" }
        ];
        container.innerHTML = cards.map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.15rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");
      }

      getOrCreateRoster(side) {
        let roster = (this.state.currentScenario.rosters || []).find((candidate) => candidate.side === side);
        if (!roster) {
          roster = {
            id: "Roster-" + side,
            side,
            items: []
          };
          this.state.currentScenario.rosters.push(roster);
        }
        return roster;
      }

      renderTerrainEditor() {
        const container = document.getElementById("terrain-object-list");
        const terrainObjects = this.state.currentScenario.terrainObjects || [];
        if (!terrainObjects.length) {
          container.innerHTML = "<div class=\"empty-state\">No terrain objects yet. Add a block or noise polygon, then click the map to add vertices.</div>";
          return;
        }
        container.innerHTML = terrainObjects.map((terrain) => {
          const isActive = this.state.mapInteraction?.mode === "terrain-draw" && this.state.mapInteraction?.terrainId === terrain.id;
          return (
            "<div class=\"timeline-card\">" +
              "<div class=\"toolbar-row\" style=\"justify-content:space-between; align-items:flex-start;\">" +
                "<div><h4>" + escapeHtml(terrain.label) + "</h4><div class=\"summary-meta\">" + escapeHtml(terrain.interferenceType) + " terrain | " + terrain.areaPolygon.length + " vertices</div></div>" +
                "<button class=\"button-link remove-terrain-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">Remove</button>" +
              "</div>" +
              "<div class=\"form-grid tight\" style=\"margin-top:10px;\">" +
                "<div class=\"field-stack\"><label>Label</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"label\" type=\"text\" value=\"" + escapeHtml(terrain.label) + "\"></div>" +
                "<div class=\"field-stack\"><label>Type</label><select class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"interferenceType\">" +
                  ["Block", "Noise", "No"].map((type) => (
                    "<option value=\"" + escapeHtml(type) + "\"" + (terrain.interferenceType === type ? " selected" : "") + ">" + escapeHtml(type) + "</option>"
                  )).join("") +
                "</select></div>" +
                "<div class=\"field-stack\"><label>Height Z</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"heightZ\" type=\"number\" value=\"" + escapeHtml(String(terrain.heightZ)) + "\"></div>" +
                "<div class=\"field-stack\"><label>Clutter Penalty (dB)</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"clutterPenaltyDb\" type=\"number\" step=\"0.1\" value=\"" + escapeHtml(String(terrain.clutterPenaltyDb)) + "\"></div>" +
              "</div>" +
              "<div class=\"controls\" style=\"margin-top:10px;\">" +
                "<button class=\"terrain-draw-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">" + (isActive ? "Stop Drawing" : "Draw Polygon") + "</button>" +
                "<button class=\"terrain-clear-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">Clear Polygon</button>" +
              "</div>" +
            "</div>"
          );
        }).join("");

        container.querySelectorAll(".terrain-field").forEach((input) => {
          input.addEventListener("change", () => {
            this.updateTerrainField(input.dataset.terrainId, input.dataset.field, input.value);
          });
        });
        container.querySelectorAll(".terrain-draw-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.toggleTerrainDraw(button.dataset.terrainId);
          });
        });
        container.querySelectorAll(".terrain-clear-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.clearTerrainPolygon(button.dataset.terrainId);
          });
        });
        container.querySelectorAll(".remove-terrain-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeTerrainObject(button.dataset.terrainId);
          });
        });
      }

      addTerrainObject(interferenceType) {
        const terrainId = this.buildUniqueId("Terrain", new Set((this.state.currentScenario.terrainObjects || []).map((item) => item.id)));
        this.state.currentScenario.terrainObjects.push({
          id: terrainId,
          label: interferenceType + " Terrain",
          interferenceType,
          clutterPenaltyDb: interferenceType === "Noise" ? 6 : 0,
          heightZ: interferenceType === "Block" ? 80 : 60,
          areaPolygon: []
        });
        this.updateScenarioState("Terrain object added");
      }

      updateTerrainField(terrainId, field, value) {
        const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === terrainId);
        if (!terrain) {
          return;
        }
        terrain[field] = ["heightZ", "clutterPenaltyDb"].includes(field)
          ? Number(value || 0)
          : value;
        this.updateScenarioState("Updated terrain");
      }

      toggleTerrainDraw(terrainId) {
        if (this.state.mapInteraction?.mode === "terrain-draw" && this.state.mapInteraction?.terrainId === terrainId) {
          this.state.mapInteraction = null;
          this.setStatus("Terrain draw complete");
        } else {
          this.state.mapInteraction = { mode: "terrain-draw", terrainId };
          this.setStatus("Click the map to add terrain vertices");
        }
        this.renderTerrainEditor();
        this.updateMapSelectionChip();
      }

      clearTerrainPolygon(terrainId) {
        const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === terrainId);
        if (!terrain) {
          return;
        }
        terrain.areaPolygon = [];
        this.updateScenarioState("Cleared terrain polygon");
      }

      removeTerrainObject(terrainId) {
        this.state.currentScenario.terrainObjects = (this.state.currentScenario.terrainObjects || []).filter((candidate) => candidate.id !== terrainId);
        if (this.state.mapInteraction?.terrainId === terrainId) {
          this.state.mapInteraction = null;
        }
        this.updateScenarioState("Removed terrain");
      }

      renderRosterEditor() {
        const panel = document.getElementById("wizard-roster-panel");
        const button = document.getElementById("open-roster-inline-btn");
        if (panel) {
          panel.style.display = "block";
        }
        if (button) {
          button.style.display = "none";
        }
        const bluePanel = document.getElementById("wizard-blue-panel");
        const redPanel = document.getElementById("wizard-red-panel");
        if (bluePanel) {
          bluePanel.style.display = "none";
        }
        if (redPanel) {
          redPanel.style.display = "none";
        }
        const templateSelect = document.getElementById("instance-template-select");
        const sideSelect = document.getElementById("instance-side-select");
        const templates = this.state.currentScenario.templates || [];
        if (templateSelect) {
          templateSelect.innerHTML = templates.map((template) => (
            "<option value=\"" + escapeHtml(template.id) + "\">" + escapeHtml(template.name) + "</option>"
          )).join("");
        }
        if (sideSelect && !sideSelect.value) {
          sideSelect.value = "Blue";
        }

        const rosterRows = (this.state.currentScenario.instances || []).map((instance) => ({
          instance,
          template: templates.find((template) => template.id === instance.templateId) || null
        }));

        document.getElementById("roster-summary").innerHTML = [
          { label: "Instances", value: rosterRows.length },
          { label: "Blue", value: rosterRows.filter((row) => row.instance.side === "Blue").length },
          { label: "Red", value: rosterRows.filter((row) => row.instance.side === "Red").length },
          { label: "Templates", value: templates.length }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.05rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");

        const rosterList = document.getElementById("roster-item-list");
        rosterList.innerHTML = rosterRows.length
          ? rosterRows.map((row) => (
              "<div class=\"timeline-card\">" +
                "<div class=\"toolbar-row\" style=\"justify-content:space-between; align-items:flex-start;\">" +
                  "<div><h4>" + escapeHtml(row.instance.name) + "</h4><div class=\"summary-meta\">" + escapeHtml(row.instance.id + " | " + row.instance.side) + "</div></div>" +
                  "<div class=\"toolbar-row\">" +
                    "<button class=\"button-link select-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Select</button>" +
                    "<button class=\"button-link pick-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Pick On Map</button>" +
                    "<button class=\"button-link remove-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Remove</button>" +
                  "</div>" +
                "</div>" +
                "<div class=\"form-grid tight\" style=\"margin-top:10px;\">" +
                  "<div class=\"field-stack\"><label>Template</label><select class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"templateId\">" +
                    templates.map((template) => (
                      "<option value=\"" + escapeHtml(template.id) + "\"" + (template.id === row.instance.templateId ? " selected" : "") + ">" + escapeHtml(template.name) + "</option>"
                    )).join("") +
                  "</select></div>" +
                  "<div class=\"field-stack\"><label>Side</label><select class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"side\">" +
                    "<option value=\"Blue\"" + (row.instance.side === "Blue" ? " selected" : "") + ">Blue</option>" +
                    "<option value=\"Red\"" + (row.instance.side === "Red" ? " selected" : "") + ">Red</option>" +
                  "</select></div>" +
                  "<div class=\"field-stack\"><label>Name</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"name\" type=\"text\" value=\"" + escapeHtml(row.instance.name) + "\"></div>" +
                  "<div class=\"field-stack\"><label>X</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posX\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posX)) + "\"></div>" +
                  "<div class=\"field-stack\"><label>Y</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posY\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posY)) + "\"></div>" +
                  "<div class=\"field-stack\"><label>Z</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posZ\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posZ)) + "\"></div>" +
                "</div>" +
                "<div class=\"summary-meta\" style=\"margin-top:8px;\">" + escapeHtml(row.template ? row.template.name : "Missing template") + "</div>" +
              "</div>"
            )).join("")
          : "<div class=\"empty-state\">No instances yet. Choose a template and add one to control placement directly.</div>";

        rosterList.querySelectorAll(".select-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.selectRosterInstance(button.dataset.instanceId);
          });
        });
        rosterList.querySelectorAll(".pick-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.selectRosterInstance(button.dataset.instanceId);
            this.state.mapInteraction = { mode: "selected-object-move", instanceId: button.dataset.instanceId };
            this.updateMapSelectionChip();
            this.setStatus("Click the map to place the selected instance");
          });
        });
        rosterList.querySelectorAll(".remove-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeRosterInstance(button.dataset.instanceId);
          });
        });
        rosterList.querySelectorAll(".roster-instance-field").forEach((element) => {
          element.addEventListener("change", () => {
            this.updateRosterInstanceField(element.dataset.instanceId, element.dataset.instanceField, element.value);
          });
          element.addEventListener("input", () => {
            this.updateRosterInstanceField(element.dataset.instanceId, element.dataset.instanceField, element.value, { rerender: false });
          });
        });

        const networkList = document.getElementById("network-list");
        networkList.innerHTML = [
          { side: "Blue", id: "Blue-C2-Net-Default", type: "RF", latency: "0.25s", note: "Used automatically for Blue sensors, C2, effectors, and directed child-interceptor launches." },
          { side: "Red", id: "Red-C2-Net-Default", type: "RF", latency: "0.25s", note: "Used automatically for Red C2-directed strike behavior, with autonomous and heuristic fallback when degraded." }
        ].map((network) => (
          "<div class=\"timeline-card\"><h4>" + escapeHtml(network.side + " Network") + "</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(network.id + " | " + network.type + " | " + network.latency) + "</div>" +
          "<div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(network.note) + "</div></div>"
        )).join("");

        const powerGridList = document.getElementById("power-grid-list");
        powerGridList.innerHTML = [
          { side: "Blue", id: "Blue-Power-Default", type: "Tactical", note: "Hidden Blue power grid stays online unless a future power effect degrades it." },
          { side: "Red", id: "Red-Power-Default", type: "Tactical", note: "Hidden Red power grid supports Red C2 linkage and EW systems in the current model." }
        ].map((grid) => (
          "<div class=\"timeline-card\"><h4>" + escapeHtml(grid.side + " Power") + "</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(grid.id + " | " + grid.type) + "</div>" +
          "<div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(grid.note) + "</div></div>"
        )).join("");
      }

      addRosterInstance() {
        const side = document.getElementById("instance-side-select").value;
        const templateId = document.getElementById("instance-template-select").value;
        if (!templateId) {
          this.setStatus("Choose a template first");
          return;
        }
        const template = this.state.currentScenario.templates.find((candidate) => candidate.id === templateId);
        if (!template) {
          this.setStatus("Choose a valid template first");
          return;
        }
        const existingNames = new Set((this.state.currentScenario.instances || []).map((item) => item.name));
        const existingIds = new Set((this.state.currentScenario.instances || []).map((item) => item.id));
        const instance = {
          id: this.buildUniqueId(side + "-Instance", existingIds),
          templateId,
          name: this.buildUniqueId((template.name || "Instance") + " " + side, existingNames),
          side,
          origin: "roster",
          roles: this.kernel.ensureArray(template.defaultRoles || []),
          networkId: null,
          connectedPowerGridId: null,
          posX: side === "Blue" ? 600 : 100,
          posY: side === "Blue" ? 320 : 220,
          posZ: side === "Blue" ? 20 : 120,
          missionWaypoints: []
        };
        this.state.currentScenario.instances.push(instance);
        this.updateScenarioState("Added instance");
      }

      updateRosterInstanceField(instanceId, field, value, options = {}) {
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === instanceId);
        if (!instance) {
          return;
        }
        const rerender = options.rerender !== false;
        const numericFields = new Set(["posX", "posY", "posZ"]);
        if (field === "templateId") {
          instance.templateId = value;
        } else if (field === "side") {
          instance.side = value === "Red" ? "Red" : "Blue";
        } else if (field === "name") {
          instance.name = value || instance.name;
        } else if (numericFields.has(field)) {
          instance[field] = Number.isFinite(Number(value)) ? Number(value) : instance[field];
        }
        if (rerender) {
          this.renderRosterEditor();
        }
        this.updateScenarioState("Updated instance");
      }

      removeRosterInstance(instanceId) {
        const instances = this.state.currentScenario.instances || [];
        const index = instances.findIndex((candidate) => candidate.id === instanceId);
        if (index < 0) {
          return;
        }
        instances.splice(index, 1);
        this.updateScenarioState("Removed instance");
      }

      selectRosterInstance(instanceId) {
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === instanceId);
        if (!instance) {
          return;
        }
        this.state.selectedMapEntity = instance;
        this.renderer.setSelection(instance);
        this.renderSelectedObjectEditor();
        this.updateMapSelectionChip();
      }

      addNetwork() {
        this.state.currentScenario.networks.push({
          id: this.buildUniqueId("Network", new Set((this.state.currentScenario.networks || []).map((item) => item.id))),
          name: "New Network",
          type: "RF",
          transmissionLatencySec: 0.25
        });
        this.updateScenarioState("Added network");
      }

      updateNetworkField(index, field, value) {
        const network = (this.state.currentScenario.networks || [])[index];
        if (!network) {
          return;
        }
        network[field] = field === "transmissionLatencySec" ? Number(value || 0) : value;
        this.updateScenarioState("Updated network");
      }

      removeNetwork(index) {
        this.state.currentScenario.networks.splice(index, 1);
        this.state.currentScenario.instances.forEach((instance) => {
          if (instance.networkId && !(this.state.currentScenario.networks || []).some((network) => network.id === instance.networkId)) {
            instance.networkId = null;
          }
        });
        this.updateScenarioState("Removed network");
      }

      addPowerGrid() {
        this.state.currentScenario.powerGrids.push({
          id: this.buildUniqueId("PowerGrid", new Set((this.state.currentScenario.powerGrids || []).map((item) => item.id))),
          name: "New Power Grid",
          type: "Tactical"
        });
        this.updateScenarioState("Added power grid");
      }

      updatePowerGridField(index, field, value) {
        const grid = (this.state.currentScenario.powerGrids || [])[index];
        if (!grid) {
          return;
        }
        grid[field] = value;
        this.updateScenarioState("Updated power grid");
      }

      removePowerGrid(index) {
        this.state.currentScenario.powerGrids.splice(index, 1);
        this.state.currentScenario.instances.forEach((instance) => {
          if (instance.connectedPowerGridId && !(this.state.currentScenario.powerGrids || []).some((grid) => grid.id === instance.connectedPowerGridId)) {
            instance.connectedPowerGridId = null;
          }
        });
        this.updateScenarioState("Removed power grid");
      }

      renderSelectedObjectEditor() {
        const container = document.getElementById("selected-object-editor");
        const selection = this.state.selectedMapEntity;
        if (!selection) {
          container.innerHTML = "<div class=\"empty-state\">Select a placed object on the map to adjust coordinates and review its hidden C2 / power posture.</div>";
          return;
        }
        if (selection.type !== "object") {
          container.innerHTML = "<div class=\"empty-state\">Track selected. Tracks are review-only here; select a physical object to edit placement.</div>";
          return;
        }
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === selection.id);
        if (!instance) {
          container.innerHTML = "<div class=\"empty-state\">Selected object is part of preview-only state. Build the scenario first to edit persistent object assignments.</div>";
          return;
        }
        const template = this.getTemplateById(instance.templateId);
        const sensorSummary = (template?.components?.sensors || []).map((sensor) => sensor.type).filter(Boolean);
        const effectorSummary = (template?.components?.effectors || []).map((effector) => effector.type).filter(Boolean);
        const quickCapabilityNotes = [
          sensorSummary.length ? sensorSummary.join(", ") : "No sensors",
          effectorSummary.length ? effectorSummary.join(", ") : "No effectors",
          template?.components?.c2 ? "Includes C2" : "No C2",
          "Asset value " + Number(template?.components?.health?.assetValuePts || 0),
          (template?.components?.capability?.canOperateAutonomously === false ? "C2-dependent" : "Autonomy-capable")
        ];
        container.innerHTML =
          "<div class=\"summary-grid\" style=\"margin-bottom:12px;\">" +
            "<div class=\"summary-card\"><div class=\"label\">Object</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(instance.name) + "</div></div>" +
            "<div class=\"summary-card\"><div class=\"label\">Side / Template</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(instance.side + " / " + (template?.name || instance.templateId)) + "</div></div>" +
            "<div class=\"summary-card\"><div class=\"label\">Quick Capability View</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(quickCapabilityNotes.join(" | ")) + "</div></div>" +
          "</div>" +
          "<div class=\"form-grid tight\">" +
            "<div class=\"field-stack\"><label>X</label><input id=\"selected-object-x\" type=\"number\" value=\"" + escapeHtml(String(instance.posX)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Y</label><input id=\"selected-object-y\" type=\"number\" value=\"" + escapeHtml(String(instance.posY)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Z</label><input id=\"selected-object-z\" type=\"number\" value=\"" + escapeHtml(String(instance.posZ)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Hidden C2 / Power</label><div class=\"summary-meta\" style=\"padding-top:10px; color: var(--text);\">" + escapeHtml(instance.side + " implicit network + power grid") + "</div></div>" +
          "</div>" +
          "<div class=\"controls\" style=\"margin-top:12px;\">" +
            "<button id=\"save-selected-object-btn\">Save Object</button>" +
            "<button id=\"move-selected-object-btn\">Move On Map</button>" +
            "<button id=\"open-selected-template-btn\">Open Template</button>" +
          "</div>";

        document.getElementById("save-selected-object-btn").addEventListener("click", () => {
          instance.posX = Number(document.getElementById("selected-object-x").value || instance.posX);
          instance.posY = Number(document.getElementById("selected-object-y").value || instance.posY);
          instance.posZ = Number(document.getElementById("selected-object-z").value || instance.posZ);
          this.updateScenarioState("Updated selected object");
        });
        document.getElementById("move-selected-object-btn").addEventListener("click", () => {
          this.state.mapInteraction = { mode: "selected-object-move", instanceId: instance.id };
          this.setStatus("Click the map to move the selected object");
          this.updateMapSelectionChip();
        });
        document.getElementById("open-selected-template-btn").addEventListener("click", () => {
          this.selectTemplate(instance.templateId, "templates");
        });
      }

      updateScenarioState(statusText) {
        this.state.currentScenario = this.kernel.normalizeScenario(this.state.currentScenario);
        this.state.lastImportSummary = {
          ...(this.state.lastImportSummary || {}),
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          dirty: true
        };
        this.stopPlayback();
        this.clearResults();
        this.updateScenarioLabel();
        this.syncPlaceholderControls();
        this.ensureSelectedTemplate();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderSelectedObjectEditor();
        this.refreshExportPreview();
        if (statusText) {
          this.setStatus(statusText);
        }
      }

      buildTemplatePreset(preset) {
        if (preset === "red-uas") {
          return {
            id: "Template-Red-UAS",
            name: "Red UAS",
            category: "UAS",
            defaultRoles: ["UAS"],
            components: {
              health: { maxHealth: 90, assetValuePts: 8, isHQ: false },
              resistance: { kineticResistance: 0.18 },
              signature: { radarSignatureDb: -14 },
              movement: { speedMps: 32, stepSec: 1, waypointToleranceM: 10 },
              sensors: [],
              effectors: []
            }
          };
        }
        if (preset === "sensor-node") {
          return {
            id: "Template-Blue-Sensor",
            name: "Blue Sensor Node",
            category: "Sensor",
            defaultRoles: ["Sensor", "Asset"],
            components: {
              health: { maxHealth: 80, assetValuePts: 12, isHQ: false },
              resistance: { kineticResistance: 0.1 },
              signature: { radarSignatureDb: -6 },
              sensors: [{
                id: "Sensor-1",
                name: "Wide-Area Radar",
                type: "Radar",
                maxRangeM: 550,
                horizontalFovDeg: 360,
                verticalFovDeg: 120,
                headingDeg: 0,
                transmitPowerDb: 53,
                noiseFloorDb: -94,
                noiseSigmaDb: 1.2,
                detectionThresholdDb: 17,
                scanIntervalSec: 1,
                classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.82 },
                identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.74 }
              }],
              effectors: [],
              c2: null
            }
          };
        }
        if (preset === "effector-node") {
          return {
            id: "Template-Blue-Effector",
            name: "Blue Effector Node",
            category: "Effector",
            defaultRoles: ["Effector", "Asset", "C2"],
            components: {
              health: { maxHealth: 90, assetValuePts: 18, isHQ: false },
              resistance: { kineticResistance: 0.12 },
              signature: { radarSignatureDb: -4 },
              sensors: [],
              effectors: [{
                id: "Effector-1",
                name: "Kinetic Interceptor",
                type: "Kinetic",
                maxRangeM: 240,
                basePk: 0.72,
                basePe: 0,
                damagePoints: 140,
                ammoCapacity: 3,
                slewRateSec: 0.2,
                cooldownSec: 2,
                projectileSpeedMps: 900
              }],
              c2: { trackCapacity: 6, processingLatencySec: 0.3 }
            }
          };
        }
        if (preset === "asset") {
          return {
            id: "Template-Blue-Asset",
            name: "Blue Defended Asset",
            category: "Asset",
            defaultRoles: ["Asset"],
            components: {
              health: { maxHealth: 110, assetValuePts: 40, isHQ: false },
              resistance: { kineticResistance: 0.08 },
              signature: { radarSignatureDb: -8 },
              sensors: [],
              effectors: [],
              c2: null
            }
          };
        }
        return {
          id: "Template-Blue-Site",
          name: "Blue Site",
          category: "Defense",
          defaultRoles: ["Asset", "Sensor", "Effector", "C2"],
          components: {
            health: { maxHealth: 120, assetValuePts: 100, isHQ: true },
            resistance: { kineticResistance: 0.15 },
            signature: { radarSignatureDb: -2 },
            sensors: [{
              id: "Sensor-1",
              name: "EO / RF Sensor",
              type: "EO_IR",
              maxRangeM: 420,
              horizontalFovDeg: 140,
              verticalFovDeg: 90,
              headingDeg: 180,
              transmitPowerDb: 53,
              noiseFloorDb: -94,
              noiseSigmaDb: 1.2,
              detectionThresholdDb: 17,
              scanIntervalSec: 1,
              classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.84 },
              identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.76 }
            }],
            effectors: [{
              id: "Effector-1",
              name: "Interceptor Launcher",
              type: "Kinetic",
              maxRangeM: 230,
              basePk: 0.74,
              basePe: 0,
              damagePoints: 150,
              ammoCapacity: 3,
              slewRateSec: 0.2,
              cooldownSec: 2,
              projectileSpeedMps: 900
            }],
            c2: { trackCapacity: 8, processingLatencySec: 0.3 }
          }
        };
      }

      createTemplateFromPreset(preset) {
        const template = this.kernel.deepClone(this.buildTemplatePreset(preset));
        const existingIds = new Set(this.state.currentScenario.templates.map((item) => item.id));
        template.id = this.buildUniqueId(template.id, existingIds);
        template.name = template.name + " " + this.state.currentScenario.templates.length;
        this.state.currentScenario.templates.push(template);
        this.state.selectedTemplateId = template.id;
        this.updateScenarioState("Added template " + template.name);
        this.uiManager.showScreen("templates");
      }

      createDefaultSensorDraft(index = 0) {
        return {
          id: "Sensor-" + (index + 1),
          name: "Sensor " + (index + 1),
          type: "Radar",
          maxRangeM: 420,
          horizontalFovDeg: 360,
          verticalFovDeg: 120,
          headingDeg: 0,
          transmitPowerDb: 53,
          noiseFloorDb: -94,
          noiseSigmaDb: 1.2,
          detectionThresholdDb: 17,
          scanIntervalSec: 1,
          classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.8 },
          identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.72 }
        };
      }

      createDefaultEffectorDraft(index = 0, type = "Kinetic") {
        const effectorType = type || "Kinetic";
        const affectedDomains = ({
          Jammer: ["Sensor", "Network", "C2"],
          Spoofer: ["Navigation"],
          Cyber: ["Track", "Telemetry", "C2"]
        }[effectorType] || []);
        return {
          id: "Effector-" + (index + 1),
          name: effectorType + " " + (index + 1),
          type: effectorType,
          deliveryModel: effectorType === "Interceptor" ? "Guided" : (effectorType === "Kinetic" ? "Ballistic" : "Instant"),
          guidanceType: effectorType === "Interceptor" ? "Command" : "Command",
          maxRangeM: effectorType === "Kinetic" ? 230 : 520,
          basePk: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 0.72 : 0,
          basePe: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 0 : 0.65,
          damagePoints: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 140 : 0,
          ammoCapacity: 3,
          slewRateSec: 0.2,
          cooldownSec: 2,
          projectileSpeedMps: effectorType === "Kinetic" || effectorType === "Interceptor" ? 900 : 0,
          terminalRadiusM: 12,
          maxFlightTimeSec: 8,
          effectDurationSec: 6,
          jamStrengthDb: 8,
          affectedDomains
        };
      }

      renderTemplateHelperSummary(template) {
        const container = document.getElementById("template-helper-summary");
        if (!template) {
          container.innerHTML = "<div class=\"empty-state\">Select a template to see helper guidance and quick actions.</div>";
          return;
        }
        const roles = this.kernel.ensureArray(template.defaultRoles || []);
        const sensorCount = this.state.templateEditorSensors.length;
        const effectorCount = this.state.templateEditorEffectors.length;
        const cards = [
          {
            label: "Design Profile",
            value: roles.includes("UAS")
              ? "Mobile threat template. Movement, payload, and lost-link helpers matter most."
              : (roles.includes("Effector")
                ? "Defensive shooter template. Coverage, ammo, and effector mix are the main tuning points."
                : "Fixed or support template. Signature, survivability, and C2 support dominate.")
          },
          {
            label: "Subcomponents",
            value: sensorCount + " sensor(s), " + effectorCount + " effector(s), " + (template.components.c2 ? "C2 enabled" : "no C2")
          },
          {
            label: "Suggested Next Step",
            value: sensorCount > 1 || effectorCount > 1
              ? "Use the subcomponent lists below to tune each sensor/effector individually."
              : "Use helper buttons to seed common bundles, then tune the selected subcomponent."
          }
        ];
        container.innerHTML = cards.map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(card.value) + "</div></div>"
        )).join("");
      }

      renderTemplateSubcomponentEditor(template) {
        const structure = document.getElementById("template-structure-summary");
        const sensorList = document.getElementById("template-sensor-list");
        const effectorList = document.getElementById("template-effector-list");
        this.renderTemplateHelperSummary(template);
        if (!template) {
          structure.innerHTML = "<div class=\"empty-state\">Select a template to edit structure.</div>";
          sensorList.innerHTML = "<div class=\"empty-state\">No sensor editor active.</div>";
          effectorList.innerHTML = "<div class=\"empty-state\">No effector editor active.</div>";
          return;
        }
        const movementEnabled = !!template.components.movement;
        structure.innerHTML = [
          { label: "Movement", value: movementEnabled ? "Enabled" : "Static" },
          { label: "Sensors", value: this.state.templateEditorSensors.length },
          { label: "Effectors", value: this.state.templateEditorEffectors.length },
          { label: "Power / C2", value: (template.components.powerConsumer?.powerConsumedKw ?? 0) + " kW | " + (template.components.c2 ? "C2 enabled" : "No C2") }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");

        sensorList.innerHTML = this.state.templateEditorSensors.length
          ? this.state.templateEditorSensors.map((sensor, index) => (
              "<div class=\"subcomponent-card" + (index === this.state.activeTemplateSensorIndex ? " active" : "") + "\" data-template-sensor-index=\"" + escapeHtml(String(index)) + "\">" +
                "<h4>" + escapeHtml(sensor.name || ("Sensor " + (index + 1))) + "</h4>" +
                "<div class=\"summary-meta\">" + escapeHtml(sensor.id || ("Sensor-" + (index + 1))) + "</div>" +
                "<div class=\"summary-meta\">" + escapeHtml(sensor.type || "Radar") + " | " + escapeHtml(String(sensor.maxRangeM ?? 0)) + " m</div>" +
              "</div>"
            )).join("")
          : "<div class=\"empty-state\">No sensors yet. Add one to start component-level editing.</div>";
        effectorList.innerHTML = this.state.templateEditorEffectors.length
          ? this.state.templateEditorEffectors.map((effector, index) => (
              "<div class=\"subcomponent-card" + (index === this.state.activeTemplateEffectorIndex ? " active" : "") + "\" data-template-effector-index=\"" + escapeHtml(String(index)) + "\">" +
                "<h4>" + escapeHtml(effector.name || ("Effector " + (index + 1))) + "</h4>" +
                "<div class=\"summary-meta\">" + escapeHtml(effector.id || ("Effector-" + (index + 1))) + "</div>" +
                "<div class=\"summary-meta\">" + escapeHtml(effector.type || "Kinetic") + " | " + escapeHtml(String(effector.maxRangeM ?? 0)) + " m</div>" +
              "</div>"
            )).join("")
          : "<div class=\"empty-state\">No effectors yet. Add one to start component-level editing.</div>";

        sensorList.querySelectorAll("[data-template-sensor-index]").forEach((node) => {
          node.addEventListener("click", () => {
            this.updateTemplateSensorDraftFromForm();
            this.state.activeTemplateSensorIndex = Number(node.dataset.templateSensorIndex || 0);
            this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
            this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
          });
        });
        effectorList.querySelectorAll("[data-template-effector-index]").forEach((node) => {
          node.addEventListener("click", () => {
            this.updateTemplateEffectorDraftFromForm();
            this.state.activeTemplateEffectorIndex = Number(node.dataset.templateEffectorIndex || 0);
            this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
            this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
          });
        });
      }

      addTemplateSensor() {
        this.updateTemplateSensorDraftFromForm();
        const sensor = this.createDefaultSensorDraft(this.state.templateEditorSensors.length);
        this.state.templateEditorSensors.push(sensor);
        this.state.activeTemplateSensorIndex = this.state.templateEditorSensors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor slot added to template editor");
      }

      duplicateTemplateSensor() {
        if (!this.state.templateEditorSensors.length) {
          this.addTemplateSensor();
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        const source = this.kernel.deepClone(this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || this.state.templateEditorSensors[0]);
        source.id = this.buildUniqueId((source.id || "Sensor") + "-Copy", new Set(this.state.templateEditorSensors.map((item) => item.id)));
        source.name = (source.name || "Sensor") + " Copy";
        this.state.templateEditorSensors.push(source);
        this.state.activeTemplateSensorIndex = this.state.templateEditorSensors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor duplicated in template editor");
      }

      removeTemplateSensor() {
        if (!this.state.templateEditorSensors.length) {
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        this.state.templateEditorSensors.splice(this.state.activeTemplateSensorIndex, 1);
        this.state.activeTemplateSensorIndex = Math.max(0, Math.min(this.state.activeTemplateSensorIndex, this.state.templateEditorSensors.length - 1));
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor removed from template editor");
      }

      addTemplateEffector(type = "Kinetic") {
        this.updateTemplateEffectorDraftFromForm();
        const effector = this.createDefaultEffectorDraft(this.state.templateEditorEffectors.length, type);
        this.state.templateEditorEffectors.push(effector);
        this.state.activeTemplateEffectorIndex = this.state.templateEditorEffectors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector slot added to template editor");
      }

      duplicateTemplateEffector() {
        if (!this.state.templateEditorEffectors.length) {
          this.addTemplateEffector();
          return;
        }
        this.updateTemplateEffectorDraftFromForm();
        const source = this.kernel.deepClone(this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || this.state.templateEditorEffectors[0]);
        source.id = this.buildUniqueId((source.id || "Effector") + "-Copy", new Set(this.state.templateEditorEffectors.map((item) => item.id)));
        source.name = (source.name || "Effector") + " Copy";
        this.state.templateEditorEffectors.push(source);
        this.state.activeTemplateEffectorIndex = this.state.templateEditorEffectors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector duplicated in template editor");
      }

      removeTemplateEffector() {
        if (!this.state.templateEditorEffectors.length) {
          return;
        }
        this.updateTemplateEffectorDraftFromForm();
        this.state.templateEditorEffectors.splice(this.state.activeTemplateEffectorIndex, 1);
        this.state.activeTemplateEffectorIndex = Math.max(0, Math.min(this.state.activeTemplateEffectorIndex, this.state.templateEditorEffectors.length - 1));
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector removed from template editor");
      }

      updateTemplateSensorDraftFromForm() {
        const enabled = document.getElementById("template-sensor-enabled").checked;
        if (!enabled) {
          this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
          return;
        }
        if (!this.state.templateEditorSensors.length) {
          this.state.templateEditorSensors.push(this.createDefaultSensorDraft(0));
          this.state.activeTemplateSensorIndex = 0;
        }
        const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || this.state.templateEditorSensors[0];
        if (!sensor) {
          return;
        }
        sensor.id = document.getElementById("template-sensor-id-input").value.trim() || sensor.id || "Sensor-1";
        sensor.name = document.getElementById("template-sensor-name-input").value.trim() || sensor.name || "Sensor";
        sensor.type = document.getElementById("template-sensor-type-input").value || "Radar";
        sensor.maxRangeM = Number(document.getElementById("template-sensor-range-input").value || 0);
        sensor.headingDeg = Number(document.getElementById("template-sensor-heading-input").value || 0);
        sensor.horizontalFovDeg = Number(document.getElementById("template-sensor-hfov-input").value || 360);
        sensor.verticalFovDeg = Number(document.getElementById("template-sensor-vfov-input").value || 180);
        sensor.scanIntervalSec = Number(document.getElementById("template-sensor-scan-input").value || 1);
        sensor.detectionThresholdDb = Number(document.getElementById("template-sensor-threshold-input").value || 17);
        sensor.transmitPowerDb = Number(document.getElementById("template-sensor-transmit-input").value || 0);
        sensor.noiseFloorDb = Number(document.getElementById("template-sensor-noise-floor-input").value || -94);
        sensor.noiseSigmaDb = Number(document.getElementById("template-sensor-noise-sigma-input").value || 1.2);
        sensor.classification = sensor.classification || { canClassify: true, latencySec: 0.25, accuracyBase: 0.8 };
        sensor.identification = sensor.identification || { canIdentify: true, latencySec: 0.35, accuracyBase: 0.72 };
        sensor.classification.accuracyBase = Number(document.getElementById("template-sensor-classify-accuracy-input").value || sensor.classification.accuracyBase || 0.8);
        sensor.identification.accuracyBase = Number(document.getElementById("template-sensor-identify-accuracy-input").value || sensor.identification.accuracyBase || 0.72);
        this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
      }

      updateTemplateEffectorDraftFromForm() {
        const enabled = document.getElementById("template-effector-enabled").checked;
        if (!enabled) {
          this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
          return;
        }
        if (!this.state.templateEditorEffectors.length) {
          this.state.templateEditorEffectors.push(this.createDefaultEffectorDraft(0));
          this.state.activeTemplateEffectorIndex = 0;
        }
        const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || this.state.templateEditorEffectors[0];
        if (!effector) {
          return;
        }
        effector.id = document.getElementById("template-effector-id-input").value.trim() || effector.id || "Effector-1";
        effector.name = document.getElementById("template-effector-name-input").value.trim() || effector.name || "Effector";
        effector.type = document.getElementById("template-effector-type-input").value || "Kinetic";
        effector.guidanceType = document.getElementById("template-effector-guidance-input").value || "Command";
        effector.maxRangeM = Number(document.getElementById("template-effector-range-input").value || 0);
        effector.basePk = Number(document.getElementById("template-effector-basepk-input").value || 0);
        effector.basePe = Number(document.getElementById("template-effector-basepe-input").value || 0);
        effector.damagePoints = Number(document.getElementById("template-effector-damage-input").value || 0);
        effector.ammoCapacity = Number(document.getElementById("template-effector-ammo-input").value || 0);
        effector.slewRateSec = Number(document.getElementById("template-effector-slew-input").value || 0.2);
        effector.cooldownSec = Number(document.getElementById("template-effector-cooldown-input").value || 1.5);
        effector.projectileSpeedMps = Number(document.getElementById("template-effector-speed-input").value || 0);
        effector.terminalRadiusM = Number(document.getElementById("template-effector-terminal-radius-input").value || 12);
        effector.maxFlightTimeSec = Number(document.getElementById("template-effector-flight-time-input").value || 8);
        effector.effectDurationSec = Number(document.getElementById("template-effector-effect-duration-input").value || 6);
        effector.jamStrengthDb = Number(document.getElementById("template-effector-jam-strength-input").value || 8);
        effector.affectedDomains = document.getElementById("template-effector-domains-input").value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
      }

      applyTemplateHelper(helperId) {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        this.updateTemplateEffectorDraftFromForm();
        if (helperId === "static-asset") {
          document.getElementById("template-movement-enabled").checked = false;
          document.getElementById("template-roles-input").value = "Asset";
          document.getElementById("template-power-consumed-input").value = 2;
        } else if (helperId === "mobile-uas") {
          document.getElementById("template-movement-enabled").checked = true;
          document.getElementById("template-speed-input").value = 32;
          document.getElementById("template-step-input").value = 1;
          document.getElementById("template-waypoint-tolerance-input").value = 10;
          document.getElementById("template-roles-input").value = "UAS";
          document.getElementById("template-power-consumed-input").value = 5;
        } else if (helperId === "add-radar") {
          this.addTemplateSensor();
          const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex];
          sensor.type = "Radar";
          sensor.name = "Wide-Area Radar";
          sensor.maxRangeM = 550;
          sensor.horizontalFovDeg = 360;
          sensor.verticalFovDeg = 120;
          sensor.transmitPowerDb = 53;
          sensor.detectionThresholdDb = 17;
        } else if (helperId === "add-interceptor") {
          this.addTemplateEffector("Interceptor");
          const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex];
          effector.name = "Interceptor Launcher";
          effector.maxRangeM = 230;
          effector.basePk = 0.74;
          effector.damagePoints = 150;
          effector.projectileSpeedMps = 900;
        } else if (helperId === "add-jammer") {
          this.addTemplateEffector("Jammer");
          const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex];
          effector.name = "Stand-In Jammer";
          effector.maxRangeM = 520;
          effector.basePe = 0.92;
          effector.damagePoints = 0;
          effector.jamStrengthDb = 14;
          effector.effectDurationSec = 8;
          effector.affectedDomains = ["Sensor", "Network", "C2"];
        }
        this.populateTemplateEditor(template, { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Template helper applied");
      }

      renderTemplateBuilder() {
        const summary = document.getElementById("template-library-summary");
        const list = document.getElementById("template-list");
        const templates = this.state.currentScenario.templates;
        const search = String(this.state.templateSearch || "").trim().toLowerCase();
        const filtered = templates.filter((template) => {
          const haystack = [
            template.id,
            template.name,
            template.category,
            ...(template.defaultRoles || [])
          ].join(" ").toLowerCase();
          return !search || haystack.includes(search);
        });
        if (filtered.length && !filtered.some((template) => template.id === this.state.selectedTemplateId)) {
          this.state.selectedTemplateId = filtered[0].id;
        }
        const selected = this.ensureSelectedTemplate();
        summary.innerHTML = [
          { label: "Templates", value: templates.length },
          { label: "Filtered", value: filtered.length },
          { label: "In Use", value: templates.filter((template) => this.getTemplateUsage(template.id).length > 0).length }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.05rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");
        list.innerHTML = filtered.length
          ? filtered.map((template) => {
              const usage = this.getTemplateUsage(template.id);
              const hasSensor = (template.components.sensors || []).length > 0 ? "Sensor" : "No Sensor";
              const hasEffector = (template.components.effectors || []).length > 0 ? "Effector" : "No Effector";
              return (
                "<div class=\"template-card" + (template.id === selected?.id ? " active" : "") + "\" data-template-id=\"" + escapeHtml(template.id) + "\">" +
                  "<h4>" + escapeHtml(template.name) + "</h4>" +
                  "<div class=\"template-meta\">" + escapeHtml(template.id) + "</div>" +
                  "<div class=\"template-meta\">" + escapeHtml(template.category || "Generic") + " | " + escapeHtml((template.defaultRoles || []).join(", ") || "No roles") + "</div>" +
                  "<div class=\"template-meta\">Used by " + usage.length + " instance(s) | " + hasSensor + " | " + hasEffector + "</div>" +
                "</div>"
              );
            }).join("")
          : "<div class=\"empty-state\">No templates match the current filter.</div>";
        list.querySelectorAll("[data-template-id]").forEach((node) => {
          node.addEventListener("click", () => {
            this.selectTemplate(node.dataset.templateId);
          });
        });
        this.populateTemplateEditor(selected);
      }

      populateTemplateEditor(template, options = {}) {
        const usageSummary = document.getElementById("template-usage-summary");
        if (!template) {
          usageSummary.innerHTML = "<div class=\"empty-state\">Select or create a template to edit it.</div>";
          document.getElementById("template-helper-summary").innerHTML = "<div class=\"empty-state\">Select a template to see helper guidance and quick actions.</div>";
          document.getElementById("template-structure-summary").innerHTML = "";
          document.getElementById("template-sensor-list").innerHTML = "<div class=\"empty-state\">No sensor editor active.</div>";
          document.getElementById("template-effector-list").innerHTML = "<div class=\"empty-state\">No effector editor active.</div>";
          document.getElementById("template-json-editor").value = "";
          this.state.templateJsonDirty = false;
          return;
        }
        const preserveDrafts = !!options.preserveDrafts;
        const preserveSelection = !!options.preserveSelection;
        if (!preserveDrafts) {
          this.state.templateEditorSensors = this.kernel.deepClone(template.components.sensors || []);
          this.state.templateEditorEffectors = this.kernel.deepClone(template.components.effectors || []);
        }
        this.state.activeTemplateSensorIndex = preserveSelection
          ? Math.max(0, Math.min(this.state.activeTemplateSensorIndex, Math.max(this.state.templateEditorSensors.length - 1, 0)))
          : 0;
        this.state.activeTemplateEffectorIndex = preserveSelection
          ? Math.max(0, Math.min(this.state.activeTemplateEffectorIndex, Math.max(this.state.templateEditorEffectors.length - 1, 0)))
          : 0;
        const usage = this.getTemplateUsage(template.id);
        const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || null;
        const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || null;
        const c2 = template.components.c2 || null;
        usageSummary.innerHTML = [
          { label: "Used by", value: usage.length ? usage.map((item) => item.name).join(", ") : "No instances yet" },
          { label: "Extra components", value: Math.max(this.state.templateEditorSensors.length - 1, 0) + " extra sensor(s), " + Math.max(this.state.templateEditorEffectors.length - 1, 0) + " extra effector(s)" },
          { label: "Editor mode", value: "Component workbench + selected-template JSON" }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top: 8px; color: var(--text);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");

        document.getElementById("template-id-input").value = template.id;
        document.getElementById("template-name-input").value = template.name || "";
        document.getElementById("template-category-input").value = template.category || "";
        document.getElementById("template-roles-input").value = (template.defaultRoles || []).join(", ");
        document.getElementById("template-health-input").value = template.components.health?.maxHealth ?? 0;
        document.getElementById("template-asset-value-input").value = template.components.health?.assetValuePts ?? 0;
        document.getElementById("template-resistance-input").value = template.components.resistance?.kineticResistance ?? 0;
        document.getElementById("template-ew-resistance-input").value = template.components.resistance?.ewResistance ?? 0;
        document.getElementById("template-network-resistance-input").value = template.components.resistance?.networkResistance ?? 0;
        document.getElementById("template-signature-input").value = template.components.signature?.radarSignatureDb ?? 0;
        document.getElementById("template-acoustic-signature-input").value = template.components.signature?.acousticSignatureDb ?? 60;
        document.getElementById("template-rf-signature-input").value = template.components.signature?.rfEmissionDb ?? 20;
        document.getElementById("template-comms-resilience-input").value = template.components.vulnerability?.commsResilience ?? 0.5;
        document.getElementById("template-nav-resilience-input").value = template.components.vulnerability?.navResilience ?? 0.5;
        document.getElementById("template-cyber-resilience-input").value = template.components.vulnerability?.cyberResilience ?? 0.5;
        document.getElementById("template-ishq-input").checked = !!template.components.health?.isHQ;
        document.getElementById("template-impact-damage-input").value = template.components.payload?.impactDamagePoints ?? 0;
        document.getElementById("template-self-destruct-input").checked = template.components.payload?.selfDestructOnImpact !== false;
        document.getElementById("template-uses-network-input").checked = template.components.capability?.usesNetwork !== false;
        document.getElementById("template-uses-rf-input").checked = template.components.capability?.usesRF !== false;
        document.getElementById("template-requires-c2-input").checked = !!template.components.capability?.requiresC2;
        document.getElementById("template-autonomy-input").checked = template.components.capability?.canOperateAutonomously !== false;
        document.getElementById("template-lost-link-behavior-input").value = template.components.capability?.lostLinkBehavior || "ContinueDeadReckoning";
        document.getElementById("template-power-consumed-input").value = template.components.powerConsumer?.powerConsumedKw ?? 0;
        document.getElementById("template-movement-enabled").checked = !!template.components.movement;
        document.getElementById("template-speed-input").value = template.components.movement?.speedMps ?? 0;
        document.getElementById("template-step-input").value = template.components.movement?.stepSec ?? 1;
        document.getElementById("template-waypoint-tolerance-input").value = template.components.movement?.waypointToleranceM ?? 10;
        document.getElementById("template-sensor-enabled").checked = !!sensor;
        document.getElementById("template-sensor-id-input").value = sensor?.id || "";
        document.getElementById("template-sensor-name-input").value = sensor?.name || "";
        document.getElementById("template-sensor-type-input").value = sensor?.type || "";
        document.getElementById("template-sensor-range-input").value = sensor?.maxRangeM ?? 0;
        document.getElementById("template-sensor-heading-input").value = sensor?.headingDeg ?? 0;
        document.getElementById("template-sensor-hfov-input").value = sensor?.horizontalFovDeg ?? 360;
        document.getElementById("template-sensor-vfov-input").value = sensor?.verticalFovDeg ?? 180;
        document.getElementById("template-sensor-scan-input").value = sensor?.scanIntervalSec ?? 1;
        document.getElementById("template-sensor-threshold-input").value = sensor?.detectionThresholdDb ?? 17;
        document.getElementById("template-sensor-transmit-input").value = sensor?.transmitPowerDb ?? 53;
        document.getElementById("template-sensor-noise-floor-input").value = sensor?.noiseFloorDb ?? -94;
        document.getElementById("template-sensor-noise-sigma-input").value = sensor?.noiseSigmaDb ?? 1.2;
        document.getElementById("template-sensor-classify-accuracy-input").value = sensor?.classification?.accuracyBase ?? 0.8;
        document.getElementById("template-sensor-identify-accuracy-input").value = sensor?.identification?.accuracyBase ?? 0.72;
        document.getElementById("template-effector-enabled").checked = !!effector;
        document.getElementById("template-effector-id-input").value = effector?.id || "";
        document.getElementById("template-effector-name-input").value = effector?.name || "";
        document.getElementById("template-effector-type-input").value = effector?.type || "";
        document.getElementById("template-effector-guidance-input").value = effector?.guidanceType || "Command";
        document.getElementById("template-effector-range-input").value = effector?.maxRangeM ?? 0;
        document.getElementById("template-effector-basepk-input").value = effector?.basePk ?? 0;
        document.getElementById("template-effector-basepe-input").value = effector?.basePe ?? 0;
        document.getElementById("template-effector-damage-input").value = effector?.damagePoints ?? 0;
        document.getElementById("template-effector-ammo-input").value = effector?.ammoCapacity ?? 0;
        document.getElementById("template-effector-slew-input").value = effector?.slewRateSec ?? 0.2;
        document.getElementById("template-effector-cooldown-input").value = effector?.cooldownSec ?? 1.5;
        document.getElementById("template-effector-speed-input").value = effector?.projectileSpeedMps ?? 0;
        document.getElementById("template-effector-terminal-radius-input").value = effector?.terminalRadiusM ?? 12;
        document.getElementById("template-effector-flight-time-input").value = effector?.maxFlightTimeSec ?? 8;
        document.getElementById("template-effector-effect-duration-input").value = effector?.effectDurationSec ?? 6;
        document.getElementById("template-effector-jam-strength-input").value = effector?.jamStrengthDb ?? 8;
        document.getElementById("template-effector-domains-input").value = this.kernel.ensureArray(effector?.affectedDomains || []).join(", ");
        document.getElementById("template-c2-enabled").checked = !!c2;
        document.getElementById("template-c2-capacity-input").value = c2?.trackCapacity ?? 0;
        document.getElementById("template-c2-latency-input").value = c2?.processingLatencySec ?? 0.25;
        this.renderTemplateSubcomponentEditor(template);
        this.syncTemplateJsonEditorFromDraft(true);
      }

      saveSelectedTemplateForm() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const oldTemplateId = template.id;
        const nextTemplate = this.buildTemplateDraftSnapshot(template, { enforceUniqueId: true });
        const index = this.state.currentScenario.templates.findIndex((item) => item.id === oldTemplateId);
        if (index < 0) {
          this.setStatus("Selected template no longer exists");
          return;
        }
        this.state.currentScenario.templates[index] = nextTemplate;
        if (oldTemplateId !== nextTemplate.id) {
          this.state.currentScenario.instances.forEach((instance) => {
            if (instance.templateId === oldTemplateId) {
              instance.templateId = nextTemplate.id;
            }
          });
          this.syncWizardTemplateRefs(oldTemplateId, nextTemplate.id);
        }
        this.state.selectedTemplateId = nextTemplate.id;
        this.updateScenarioState("Saved template " + nextTemplate.name);
        this.uiManager.showScreen("templates");
      }

      duplicateSelectedTemplate() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const duplicate = this.buildTemplateDraftSnapshot(template);
        const existingIds = new Set(this.state.currentScenario.templates.map((item) => item.id));
        duplicate.id = this.buildUniqueId(duplicate.id + "-Copy", existingIds);
        duplicate.name = duplicate.name + " Copy";
        this.state.currentScenario.templates.push(duplicate);
        this.state.selectedTemplateId = duplicate.id;
        this.updateScenarioState("Duplicated template " + duplicate.name);
        this.uiManager.showScreen("templates");
      }

      deleteSelectedTemplate() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const usage = this.getTemplateUsage(template.id);
        const wizardUsage = this.getWizardTemplateBindingUsage(template.id);
        if (usage.length || wizardUsage.length) {
          this.setStatus("Cannot delete a template that is still used by instances or Scenario Wizard bindings");
          return;
        }
        this.state.currentScenario.templates = this.state.currentScenario.templates.filter((item) => item.id !== template.id);
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.updateScenarioState("Deleted template " + template.name);
        this.uiManager.showScreen("templates");
      }

      applyTemplateJsonEditor() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        try {
          this.syncTemplateJsonEditorFromDraft(false);
          const parsed = JSON.parse(document.getElementById("template-json-editor").value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Template JSON must be an object.");
          }
          const oldTemplateId = template.id;
          const index = this.state.currentScenario.templates.findIndex((item) => item.id === oldTemplateId);
          if (index < 0) {
            throw new Error("Selected template no longer exists.");
          }
          this.state.currentScenario.templates[index] = parsed;
          this.state.currentScenario = this.kernel.normalizeScenario(this.state.currentScenario);
          const replacement = this.state.currentScenario.templates[index];
          if (replacement && oldTemplateId !== replacement.id) {
            this.state.currentScenario.instances.forEach((instance) => {
              if (instance.templateId === oldTemplateId) {
                instance.templateId = replacement.id;
              }
            });
            this.syncWizardTemplateRefs(oldTemplateId, replacement.id);
          }
          this.state.selectedTemplateId = replacement?.id || oldTemplateId;
          this.state.templateJsonDirty = false;
          this.updateScenarioState("Applied advanced template JSON");
          this.uiManager.showScreen("templates");
        } catch (error) {
          this.setStatus("Template JSON error: " + String(error && error.message ? error.message : error));
        }
      }

      loadWizardGeneratorPattern(preset) {
        const presets = {
          "blank-scratch": {
            scenarioName: "New Scenario",
            description: "Start from scratch, then add Blue assets, Red threat groups, and optional environment placeholders.",
            mapWidth: 1080,
            blueAssets: [
              {
                name: "Blue Site",
                templateRef: "preset:blue-site",
                posX: 670,
                posY: 315,
                posZ: 20,
                isHQ: true
              }
            ],
            threatGroups: [],
            ghost: false,
            clutter: false
          },
          "baseline-single": {
            scenarioName: "Editor Baseline",
            description: "Single-UAS baseline built from the quick-start wizard.",
            mapWidth: 1080,
            blueAssets: [
              {
                name: "Blue Site 01",
                templateRef: "preset:blue-site",
                posX: 670,
                posY: 315,
                posZ: 20,
                isHQ: true
              }
            ],
            threatGroups: [
              {
                templateName: "Red Recon Strike UAS",
                templateRef: "preset:red-uas",
                instancePrefix: "Red UAS",
                profile: "recon-strike",
                count: 1,
                speed: 35,
                health: 90,
                signature: -14,
                routePattern: "direct",
                startX: 90,
                startY: 315,
                startZ: 120,
                endX: 980,
                endY: 315,
                endZ: 120,
                startSpacingY: 0,
                endSpacingY: 0
              }
            ],
            ghost: false,
            clutter: false
          },
          "lock-refire": {
            scenarioName: "Editor Lock Refire",
            description: "Two threats to review locked engagements and autonomous refire behavior.",
            mapWidth: 1080,
            blueAssets: [
              {
                name: "Blue Lock Site",
                templateRef: "preset:blue-site",
                posX: 650,
                posY: 315,
                posZ: 20,
                isHQ: true
              }
            ],
            threatGroups: [
              {
                templateName: "Red Attack UAS",
                templateRef: "preset:red-uas",
                instancePrefix: "Raid UAS",
                profile: "attack",
                count: 2,
                speed: 34,
                health: 95,
                signature: -12,
                routePattern: "staggered",
                startX: 110,
                startY: 315,
                startZ: 120,
                endX: 930,
                endY: 315,
                endZ: 120,
                startSpacingY: 110,
                endSpacingY: 40
              }
            ],
            ghost: false,
            clutter: false
          },
          "tewa-priority": {
            scenarioName: "Editor TEWA Priority",
            description: "Two defended assets and mixed Red threats for TEWA priority review.",
            mapWidth: 1080,
            blueAssets: [
              {
                name: "Blue HQ Node",
                templateRef: "preset:blue-site",
                posX: 700,
                posY: 275,
                posZ: 20,
                isHQ: true
              },
              {
                name: "Water Tank",
                templateRef: "preset:asset",
                posX: 680,
                posY: 415,
                posZ: 10,
                isHQ: false
              }
            ],
            threatGroups: [
              {
                templateName: "Red Bomber UAS",
                templateRef: "preset:red-uas",
                instancePrefix: "Bomber",
                profile: "bomber",
                count: 1,
                speed: 38,
                health: 120,
                signature: -7,
                routePattern: "direct",
                startX: 70,
                startY: 260,
                startZ: 120,
                endX: 940,
                endY: 275,
                endZ: 120,
                startSpacingY: 0,
                endSpacingY: 0
              },
              {
                templateName: "Red ISR UAS",
                templateRef: "preset:red-uas",
                instancePrefix: "ISR Decoy",
                profile: "isr",
                count: 1,
                speed: 22,
                health: 85,
                signature: -18,
                routePattern: "direct",
                startX: 100,
                startY: 385,
                startZ: 120,
                endX: 880,
                endY: 420,
                endZ: 120,
                startSpacingY: 0,
                endSpacingY: 0
              }
            ],
            ghost: false,
            clutter: false
          }
        };
        const values = presets[preset] || presets["baseline-single"];
        document.getElementById("wizard-preset").value = preset;
        document.getElementById("wizard-scenario-name").value = values.scenarioName;
        document.getElementById("wizard-scenario-description").value = values.description;
        document.getElementById("map-width-input").value = values.mapWidth || 1080;
        this.state.wizardBlueAssets = (values.blueAssets || []).map((asset) => this.createWizardBlueAsset(asset));
        this.state.activeWizardBlueAssetId = this.state.wizardBlueAssets[0]?.localId || null;
        this.renderWizardBlueAssets();
        this.state.wizardThreatGroups = (values.threatGroups || []).map((group) => this.createWizardThreatGroup(group));
        this.state.activeWizardThreatGroupId = this.state.wizardThreatGroups[0]?.localId || null;
        this.renderWizardThreatGroups();
        document.getElementById("wizard-ghost-enabled").checked = values.ghost;
        document.getElementById("wizard-clutter-enabled").checked = values.clutter;
      }

      loadWizardPreset(preset) {
        this.loadWizardGeneratorPattern(preset);
      }

      createWizardBlueAsset(overrides = {}) {
        const asset = {
          localId: "blue-asset-" + this.state.nextWizardBlueAssetId,
          name: "Blue Asset",
          templateRef: "preset:blue-site",
          posX: 670,
          posY: 315,
          posZ: 20,
          isHQ: false
        };
        this.state.nextWizardBlueAssetId += 1;
        return {
          ...asset,
          ...this.kernel.deepClone(overrides)
        };
      }

      getWizardBlueTemplateOptions() {
        const templateOptions = this.state.currentScenario.templates
          .filter((template) => {
            const roles = this.kernel.ensureArray(template.defaultRoles || []);
            return !roles.includes("UAS");
          })
          .map((template) => ({
            value: "template:" + template.id,
            label: template.name + " (Current Template)"
          }));
        return [
          { value: "preset:blue-site", label: "Preset: Blue Site" },
          { value: "preset:sensor-node", label: "Preset: Sensor Node" },
          { value: "preset:effector-node", label: "Preset: Effector Node" },
          { value: "preset:asset", label: "Preset: Defended Asset" },
          ...templateOptions
        ];
      }

      renderWizardBlueAssets() {
        const container = document.getElementById("wizard-blue-asset-list");
        const assets = this.state.wizardBlueAssets;
        if (!assets.length) {
          container.innerHTML = "<div class=\"empty-state\">No Blue assets yet. Add one to define template binding and placement.</div>";
          return;
        }
        const templateOptions = this.getWizardBlueTemplateOptions();
        container.innerHTML = assets.map((asset, index) => (
          "<div class=\"threat-group-card" + (this.state.activeWizardBlueAssetId === asset.localId ? " active" : "") + "\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">" +
            "<div class=\"threat-group-header\">" +
              "<div>" +
                "<h4>Blue Asset " + escapeHtml(String(index + 1)) + "</h4>" +
                "<div class=\"threat-group-subtitle\">" + escapeHtml(asset.name || "Blue Asset") + " | " + escapeHtml(templateOptions.find((option) => option.value === asset.templateRef)?.label || asset.templateRef) + (asset.isHQ ? " | HQ" : "") + "</div>" +
              "</div>" +
              "<div class=\"toolbar-row\">" +
                "<button class=\"button-link wizard-select-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Select</button>" +
                "<button class=\"button-link wizard-pick-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Pick On Map</button>" +
                "<button class=\"button-link wizard-remove-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Remove Asset</button>" +
              "</div>" +
            "</div>" +
            "<div class=\"form-grid tight\">" +
              "<div class=\"field-stack\"><label>Name</label><input data-blue-asset-field=\"name\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"text\" value=\"" + escapeHtml(asset.name) + "\"></div>" +
              "<div class=\"field-stack\"><label>Template</label><select data-blue-asset-field=\"templateRef\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">" +
                templateOptions.map((option) => (
                  "<option value=\"" + escapeHtml(option.value) + "\"" + (asset.templateRef === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>"
                )).join("") +
              "</select></div>" +
              "<div class=\"field-stack\"><label>X</label><input data-blue-asset-field=\"posX\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Y</label><input data-blue-asset-field=\"posY\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Z</label><input data-blue-asset-field=\"posZ\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posZ)) + "\"></div>" +
              "<div class=\"field-stack inline-check\"><input data-blue-asset-field=\"isHQ\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"checkbox\"" + (asset.isHQ ? " checked" : "") + "><label>Mark as HQ / defended primary asset</label></div>" +
            "</div>" +
          "</div>"
        )).join("");

        container.querySelectorAll("[data-blue-asset-field]").forEach((element) => {
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            const value = element.type === "checkbox" ? element.checked : element.value;
            this.updateWizardBlueAssetField(element.dataset.blueAssetId, element.dataset.blueAssetField, value, { rerender: eventName !== "input" });
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              const value = element.type === "checkbox" ? element.checked : element.value;
              this.updateWizardBlueAssetField(element.dataset.blueAssetId, element.dataset.blueAssetField, value, { rerender: true });
            });
          }
        });
        container.querySelectorAll(".wizard-remove-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeWizardBlueAsset(button.dataset.blueAssetId);
          });
        });
        container.querySelectorAll(".wizard-select-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardBlueAssetId = button.dataset.blueAssetId;
            this.renderWizardBlueAssets();
            this.setStatus("Blue asset selected");
          });
        });
        container.querySelectorAll(".wizard-pick-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardBlueAssetId = button.dataset.blueAssetId;
            this.state.mapInteraction = { mode: "blue-asset-position", blueAssetId: button.dataset.blueAssetId };
            this.renderWizardBlueAssets();
            this.updateMapSelectionChip();
            this.setStatus("Click the map to place Blue asset");
          });
        });
      }

      addWizardBlueAsset(overrides = {}) {
        const asset = this.createWizardBlueAsset(overrides);
        this.state.wizardBlueAssets.push(asset);
        this.state.activeWizardBlueAssetId = asset.localId;
        this.renderWizardBlueAssets();
        this.refreshWizardSummary();
        this.setStatus("Blue asset added");
      }

      removeWizardBlueAsset(localId) {
        this.state.wizardBlueAssets = this.state.wizardBlueAssets.filter((asset) => asset.localId !== localId);
        if (this.state.activeWizardBlueAssetId === localId) {
          this.state.activeWizardBlueAssetId = this.state.wizardBlueAssets[0]?.localId || null;
        }
        this.renderWizardBlueAssets();
        this.refreshWizardSummary();
        this.setStatus("Blue asset removed");
      }

      updateWizardBlueAssetField(localId, field, value, options = {}) {
        const asset = this.state.wizardBlueAssets.find((item) => item.localId === localId);
        if (!asset) {
          return;
        }
        const rerender = options.rerender !== false;
        const numericFields = new Set(["posX", "posY", "posZ"]);
        if (field === "isHQ") {
          asset.isHQ = !!value;
        } else if (numericFields.has(field)) {
          asset[field] = Number.isFinite(Number(value)) ? Number(value) : asset[field];
        } else {
          asset[field] = value;
        }
        if (rerender) {
          this.renderWizardBlueAssets();
        }
        this.refreshWizardSummary();
      }

      createWizardThreatGroup(overrides = {}) {
        const group = {
          localId: "threat-group-" + this.state.nextWizardThreatGroupId,
          templateName: "Red UAS",
          templateRef: "preset:red-uas",
          instancePrefix: "Red UAS",
          profile: "recon-strike",
          count: 1,
          speed: 35,
          health: 90,
          signature: -14,
          routePattern: "direct",
          startX: 90,
          startY: 315,
          startZ: 120,
          endX: 980,
          endY: 315,
          endZ: 120,
          startSpacingY: 0,
          endSpacingY: 0
        };
        this.state.nextWizardThreatGroupId += 1;
        return {
          ...group,
          ...this.kernel.deepClone(overrides)
        };
      }

      getWizardRedTemplateOptions() {
        const templateOptions = this.state.currentScenario.templates
          .filter((template) => {
            const roles = this.kernel.ensureArray(template.defaultRoles || []);
            return roles.includes("UAS") || String(template.category || "").toUpperCase() === "UAS";
          })
          .map((template) => ({
            value: "template:" + template.id,
            label: template.name + " (Current Template)"
          }));
        return [
          { value: "preset:red-uas", label: "Preset: Red UAS" },
          ...templateOptions
        ];
      }

      getWizardThreatProfileDefaults(profile) {
        const defaults = {
          "recon-strike": {
            templateName: "Red Recon Strike UAS",
            instancePrefix: "Red UAS",
            speed: 35,
            health: 90,
            signature: -14
          },
          attack: {
            templateName: "Red Attack UAS",
            instancePrefix: "Attack UAS",
            speed: 34,
            health: 95,
            signature: -12
          },
          bomber: {
            templateName: "Red Bomber UAS",
            instancePrefix: "Bomber",
            speed: 38,
            health: 120,
            signature: -7
          },
          isr: {
            templateName: "Red ISR UAS",
            instancePrefix: "ISR UAS",
            speed: 22,
            health: 85,
            signature: -18
          }
        };
        return defaults[profile] || defaults["recon-strike"];
      }

      addWizardThreatGroup(overrides = {}) {
        const group = this.createWizardThreatGroup(overrides);
        this.state.wizardThreatGroups.push(group);
        this.state.activeWizardThreatGroupId = group.localId;
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.setStatus("Threat group added");
      }

      removeWizardThreatGroup(localId) {
        this.state.wizardThreatGroups = this.state.wizardThreatGroups.filter((group) => group.localId !== localId);
        if (this.state.activeWizardThreatGroupId === localId) {
          this.state.activeWizardThreatGroupId = this.state.wizardThreatGroups[0]?.localId || null;
        }
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.setStatus("Threat group removed");
      }

      renderWizardThreatGroups() {
        const container = document.getElementById("wizard-threat-group-list");
        const groups = this.state.wizardThreatGroups;
        if (!groups.length) {
          container.innerHTML = "<div class=\"empty-state\">No threat groups yet. Add one to define a Red template, count, and route.</div>";
          return;
        }
        const templateOptions = this.getWizardRedTemplateOptions();
        container.innerHTML = groups.map((group, index) => (
          "<div class=\"threat-group-card" + (this.state.activeWizardThreatGroupId === group.localId ? " active" : "") + "\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
            "<div class=\"threat-group-header\">" +
              "<div>" +
                "<h4>Threat Group " + escapeHtml(String(index + 1)) + "</h4>" +
                "<div class=\"threat-group-subtitle\">" + escapeHtml(group.templateName || "Red UAS") + " | " + escapeHtml(templateOptions.find((option) => option.value === group.templateRef)?.label || group.templateRef) + " | " + escapeHtml(group.routePattern) + " pattern | " + escapeHtml(String(group.count)) + " instance(s)</div>" +
              "</div>" +
              "<div class=\"toolbar-row\">" +
                "<button class=\"button-link wizard-select-group-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Select</button>" +
                "<button class=\"button-link wizard-pick-start-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Pick Start</button>" +
                "<button class=\"button-link wizard-pick-end-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Pick End</button>" +
                "<button class=\"button-link wizard-remove-group-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Remove Group</button>" +
              "</div>" +
            "</div>" +
            "<div class=\"form-grid tight\">" +
              "<div class=\"field-stack\"><label>Template Name</label><input data-group-field=\"templateName\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"text\" value=\"" + escapeHtml(group.templateName) + "\"></div>" +
              "<div class=\"field-stack\"><label>Template</label><select data-group-field=\"templateRef\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                templateOptions.map((option) => (
                  "<option value=\"" + escapeHtml(option.value) + "\"" + (group.templateRef === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>"
                )).join("") +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Instance Prefix</label><input data-group-field=\"instancePrefix\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"text\" value=\"" + escapeHtml(group.instancePrefix) + "\"></div>" +
              "<div class=\"field-stack\"><label>Threat Profile</label><select data-group-field=\"profile\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                "<option value=\"recon-strike\"" + (group.profile === "recon-strike" ? " selected" : "") + ">Recon Strike</option>" +
                "<option value=\"attack\"" + (group.profile === "attack" ? " selected" : "") + ">Attack</option>" +
                "<option value=\"bomber\"" + (group.profile === "bomber" ? " selected" : "") + ">Bomber</option>" +
                "<option value=\"isr\"" + (group.profile === "isr" ? " selected" : "") + ">ISR Decoy</option>" +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Route Pattern</label><select data-group-field=\"routePattern\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                "<option value=\"direct\"" + (group.routePattern === "direct" ? " selected" : "") + ">Direct</option>" +
                "<option value=\"staggered\"" + (group.routePattern === "staggered" ? " selected" : "") + ">Staggered Lanes</option>" +
                "<option value=\"fan-in\"" + (group.routePattern === "fan-in" ? " selected" : "") + ">Fan In</option>" +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Count</label><input data-group-field=\"count\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" min=\"1\" max=\"6\" value=\"" + escapeHtml(String(group.count)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Speed (m/s)</label><input data-group-field=\"speed\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.speed)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Health</label><input data-group-field=\"health\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.health)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Signature (dB)</label><input data-group-field=\"signature\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.signature)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start X</label><input data-group-field=\"startX\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Y</label><input data-group-field=\"startY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Z</label><input data-group-field=\"startZ\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startZ)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End X</label><input data-group-field=\"endX\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Y</label><input data-group-field=\"endY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Z</label><input data-group-field=\"endZ\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endZ)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Spacing Y</label><input data-group-field=\"startSpacingY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startSpacingY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Spacing Y</label><input data-group-field=\"endSpacingY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endSpacingY)) + "\"></div>" +
            "</div>" +
          "</div>"
        )).join("");

        container.querySelectorAll("[data-group-field]").forEach((element) => {
          element.addEventListener("input", () => {
            this.updateWizardThreatGroupField(element.dataset.threatGroupId, element.dataset.groupField, element.value, { rerender: false });
          });
          element.addEventListener("change", () => {
            this.updateWizardThreatGroupField(element.dataset.threatGroupId, element.dataset.groupField, element.value, { rerender: true });
          });
        });
        container.querySelectorAll(".wizard-remove-group-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeWizardThreatGroup(button.dataset.threatGroupId);
          });
        });
        container.querySelectorAll(".wizard-select-group-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.renderWizardThreatGroups();
            this.setStatus("Threat group selected");
          });
        });
        container.querySelectorAll(".wizard-pick-start-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.state.mapInteraction = { mode: "group-start", threatGroupId: button.dataset.threatGroupId };
            this.renderWizardThreatGroups();
            this.setStatus("Click the map to place threat-group start");
          });
        });
        container.querySelectorAll(".wizard-pick-end-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.state.mapInteraction = { mode: "group-end", threatGroupId: button.dataset.threatGroupId };
            this.renderWizardThreatGroups();
            this.setStatus("Click the map to place threat-group end");
          });
        });
      }

      updateWizardThreatGroupField(localId, field, value, options = {}) {
        const group = this.state.wizardThreatGroups.find((item) => item.localId === localId);
        if (!group) {
          return;
        }
        const rerender = options.rerender !== false;
        const numericFields = new Set(["count", "speed", "health", "signature", "startX", "startY", "startZ", "endX", "endY", "endZ", "startSpacingY", "endSpacingY"]);
        if (field === "profile") {
          group.profile = value;
          const defaults = this.getWizardThreatProfileDefaults(value);
          group.templateName = defaults.templateName;
          group.instancePrefix = defaults.instancePrefix;
          group.speed = defaults.speed;
          group.health = defaults.health;
          group.signature = defaults.signature;
        } else if (numericFields.has(field)) {
          group[field] = Number.isFinite(Number(value)) ? Number(value) : group[field];
          if (field === "count") {
            group.count = Math.max(1, Math.min(6, Math.floor(group.count)));
          }
        } else {
          group[field] = value;
        }
        if (rerender) {
          this.renderWizardThreatGroups();
        }
        this.refreshWizardSummary();
      }

      getWizardInputNumber(id, fallback = 0) {
        const value = Number(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
      }

      resolveWizardTemplateRef(templateRef, fallbackPreset, options = {}) {
        const normalizedRef = String(templateRef || fallbackPreset || "").trim();
        if (normalizedRef.startsWith("template:")) {
          const templateId = normalizedRef.slice("template:".length);
          const match = this.state.currentScenario.templates.find((template) => template.id === templateId);
          if (match) {
            return this.kernel.deepClone(match);
          }
          if (options.strict) {
            throw new Error("Scenario Wizard references missing template " + templateId);
          }
        }
        const preset = normalizedRef.startsWith("preset:")
          ? normalizedRef.slice("preset:".length)
          : (fallbackPreset || "asset");
        return this.kernel.deepClone(this.buildTemplatePreset(preset));
      }

      isWizardBuildPending() {
        try {
          if (this.state.currentScenarioSource !== "wizard-generated") {
            return false;
          }
          const wizardScenario = this.buildScenarioFromWizardInputs();
          return JSON.stringify(wizardScenario) !== JSON.stringify(this.state.currentScenario);
        } catch (error) {
          return false;
        }
      }

      updateWizardBuildReminder() {
        const wizardContainer = document.getElementById("wizard-reminder");
        const runContainer = document.getElementById("run-reminder");
        const needsBuild = this.isWizardBuildPending();
        const reminderHtml = this.state.currentScenarioSource === "wizard-generated"
          ? (needsBuild
            ? "<div class=\"attention-card\"><strong>Scenario wizard changes are not active yet.</strong> Click <strong>Generate From Wizard</strong> before running if you want the current wizard values to become the live scenario.</div>"
            : "<div class=\"summary-meta\">Scenario wizard draft matches the active generated scenario.</div>")
          : "<div class=\"summary-meta\">Live scenario editing is separate from the generator draft. Use <strong>Generate From Wizard</strong> only when you want to replace the active scenario.</div>";
        wizardContainer.innerHTML = reminderHtml;
        runContainer.innerHTML = needsBuild
          ? "<div class=\"attention-card\"><strong>Reminder:</strong> if you edited the Scenario Wizard, click <strong>Generate From Wizard</strong> first. Running now uses the current active scenario, not the unsaved wizard draft.</div>"
          : "";
      }

      buildScenarioFromWizardInputs() {
        const scenarioName = document.getElementById("wizard-scenario-name").value.trim() || "Scenario Wizard Draft";
        const description = document.getElementById("wizard-scenario-description").value.trim();

        const scenario = {
          metadata: {
            name: scenarioName,
            description
          },
          config: {
            maxTimeSec: 55,
            trackStaleAfterSec: 4,
            attackRunRangeM: 240,
            projectedPathToleranceM: 50
          },
          environment: {
            baseNoiseDb: 1.8,
            mapWidthMeters: this.getWizardInputNumber("map-width-input", 1080),
            backgroundImageBase64: this.state.currentScenario.environment.backgroundImageBase64 || "",
            placeholderGhostTrack: {
              enabled: document.getElementById("wizard-ghost-enabled").checked,
              spawnTimeSec: 7,
              posX: 505,
              posY: 182,
              posZ: 110,
              label: "Ghost Track Placeholder"
            },
            placeholderClutterField: {
              enabled: document.getElementById("wizard-clutter-enabled").checked,
              centerX: 410,
              centerY: 430,
              radiusM: 100,
              label: "Clutter Placeholder"
            }
          },
          terrainObjects: this.kernel.deepClone(this.state.currentScenario.terrainObjects || []),
          networks: [],
          powerGrids: [],
          rosters: [],
          templates: this.kernel.deepClone(this.state.currentScenario.templates || []),
          instances: []
        };

        const templateIds = new Set();
        const instanceIds = new Set();
        const blueAssets = this.state.wizardBlueAssets.length
          ? this.state.wizardBlueAssets
          : [{ name: "Blue Site", templateRef: "preset:blue-site", posX: 670, posY: 315, posZ: 20, isHQ: true }];
        blueAssets.forEach((asset, assetIndex) => {
          const blueTemplate = this.resolveWizardTemplateRef(asset.templateRef, "blue-site", { strict: true });
          blueTemplate.id = this.buildUniqueId("Template-Blue-" + String(assetIndex + 1).padStart(2, "0"), templateIds);
          templateIds.add(blueTemplate.id);
          blueTemplate.name = (asset.name || blueTemplate.name || "Blue Asset") + " Template";
          blueTemplate.components = blueTemplate.components || {};
          blueTemplate.components.health = blueTemplate.components.health || { maxHealth: 100, assetValuePts: 40, isHQ: false };
          blueTemplate.components.health.isHQ = !!asset.isHQ;
          scenario.templates.push(blueTemplate);
          const defaultRoles = this.kernel.ensureArray(blueTemplate.defaultRoles || []);
          const roles = defaultRoles.length ? defaultRoles : ["Asset"];
          const instanceId = this.buildUniqueId("Blue-Asset-" + String(assetIndex + 1).padStart(2, "0"), instanceIds);
          instanceIds.add(instanceId);
          scenario.instances.push({
            id: instanceId,
            templateId: blueTemplate.id,
            name: asset.name || ("Blue Asset " + (assetIndex + 1)),
            side: "Blue",
            roles,
            networkId: null,
            connectedPowerGridId: null,
            posX: Number(asset.posX || 670),
            posY: Number(asset.posY || 315),
            posZ: Number(asset.posZ || 20),
            missionWaypoints: []
          });
        });

        const primaryBlueInstance = scenario.instances.find((instance) => {
          const template = scenario.templates.find((item) => item.id === instance.templateId);
          return instance.side === "Blue" && template?.components?.health?.isHQ;
        }) || scenario.instances.find((instance) => instance.side === "Blue") || null;
        const primaryBlueTemplateId = primaryBlueInstance?.templateId || null;

        this.state.wizardThreatGroups.forEach((group, groupIndex) => {
          const redTemplate = this.resolveWizardTemplateRef(group.templateRef, "red-uas", { strict: true });
          redTemplate.name = group.templateName || redTemplate.name || ("Red Group " + (groupIndex + 1));
          redTemplate.components.health.maxHealth = Number(group.health || 90);
          redTemplate.components.signature.radarSignatureDb = Number(group.signature || -14);
          redTemplate.components.movement.speedMps = Number(group.speed || 35);
          redTemplate.missionProfile = group.profile === "isr"
            ? { type: "Geographic", targetTemplateId: null }
            : (group.profile === "attack"
              ? { type: "SpecificAsset", targetTemplateId: primaryBlueTemplateId }
              : { type: "MaxDamage", targetTemplateId: null });
          const templateId = this.buildUniqueId("Template-Red-Group-" + String(groupIndex + 1).padStart(2, "0"), templateIds);
          templateIds.add(templateId);
          scenario.templates.push({
            ...redTemplate,
            id: templateId
          });

          const count = Math.max(1, Math.floor(Number(group.count || 1)));
          const centerIndex = (count - 1) / 2;
          for (let index = 0; index < count; index += 1) {
            let startYOffset = 0;
            let endYOffset = 0;
            if (group.routePattern === "staggered") {
              startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
              endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0);
            } else if (group.routePattern === "fan-in") {
              startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
              endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0) * 0.2;
            }
            const instanceId = this.buildUniqueId("Red-G" + String(groupIndex + 1) + "-" + String(index + 1).padStart(2, "0"), instanceIds);
            instanceIds.add(instanceId);
            scenario.instances.push({
              id: instanceId,
              templateId,
              name: (group.instancePrefix || ("Threat " + (groupIndex + 1))) + " " + (index + 1),
              side: "Red",
              roles: this.kernel.ensureArray(redTemplate.defaultRoles || []).length ? this.kernel.ensureArray(redTemplate.defaultRoles || []) : ["UAS"],
              networkId: null,
              connectedPowerGridId: null,
              posX: Number(group.startX || 90),
              posY: Number(group.startY || 315) + startYOffset,
              posZ: Number(group.startZ || 120),
              missionWaypoints: [
                {
                  x: Number(group.endX || 980),
                  y: Number(group.endY || 315) + endYOffset,
                  z: Number(group.endZ || 120)
                }
              ]
            });
          }
        });

        const blueRosterItems = scenario.instances
          .filter((instance) => instance.side === "Blue")
          .reduce((accumulator, instance) => {
            const existing = accumulator.find((item) => item.templateId === instance.templateId);
            if (existing) {
              existing.quantity += 1;
            } else {
              accumulator.push({ templateId: instance.templateId, quantity: 1 });
            }
            return accumulator;
          }, []);
        const redRosterItems = scenario.instances
          .filter((instance) => instance.side === "Red")
          .reduce((accumulator, instance) => {
            const existing = accumulator.find((item) => item.templateId === instance.templateId);
            if (existing) {
              existing.quantity += 1;
            } else {
              accumulator.push({ templateId: instance.templateId, quantity: 1 });
            }
            return accumulator;
          }, []);
        scenario.rosters = [
          { id: "Roster-Blue", side: "Blue", items: blueRosterItems },
          { id: "Roster-Red", side: "Red", items: redRosterItems }
        ];

        return this.kernel.normalizeScenario(scenario);
      }

      refreshWizardSummary() {
        const container = document.getElementById("wizard-summary");
        try {
          const scenario = this.buildScenarioFromWizardInputs();
          const validation = this.kernel.validateScenario(scenario);
          const blueCount = scenario.instances.filter((instance) => instance.side === "Blue").length;
          const redCount = scenario.instances.filter((instance) => instance.side === "Red").length;
          const cards = [
            { label: "Templates", value: scenario.templates.length },
            { label: "Blue Assets", value: this.state.wizardBlueAssets.length || blueCount },
            { label: "Threat Groups", value: this.state.wizardThreatGroups.length },
            { label: "Blue / Red", value: blueCount + " / " + redCount },
            { label: "Blockers", value: validation.issues.errors.length },
            { label: "Warnings", value: validation.issues.warnings.length },
            { label: "Notes", value: validation.issues.notes.length }
          ];
          container.innerHTML = cards.map((card) => (
            "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.1rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
          )).join("");
          if (!this.state.singleRun && document.getElementById("screen-wizard").classList.contains("sidebar-active")) {
            this.renderScenarioModel(validation.scenario, { preserveSelection: false });
          }
          this.updateWizardBuildReminder();
        } catch (error) {
          container.innerHTML = "<div class=\"empty-state\">Scenario editor preview error: " + escapeHtml(String(error && error.message ? error.message : error)) + "</div>";
          this.updateWizardBuildReminder();
        }
      }

      buildScenarioFromWizard() {
        try {
          const scenario = this.buildScenarioFromWizardInputs();
          this.state.currentScenario = scenario;
          this.state.currentScenarioSource = "wizard-generated";
          this.state.originalScenarioPayloadText = "";
          this.state.scenarioExportSource = "normalized";
          document.getElementById("scenario-export-source").value = "normalized";
          this.state.lastImportSummary = {
            source: "Scenario Wizard",
            templateCount: scenario.templates.length,
            instanceCount: scenario.instances.length,
            normalizedChanged: false,
            dirty: false
          };
          this.state.selectedTemplateId = scenario.templates[0]?.id || null;
          this.stopPlayback();
          this.clearResults();
          this.updateScenarioLabel();
          this.syncPlaceholderControls();
          this.refreshValidationSummary();
          this.refreshImportSummary();
          this.renderTemplateBuilder();
          this.renderRosterEditor();
          this.renderTerrainEditor();
          this.renderWizardBlueAssets();
          this.renderWizardThreatGroups();
          this.refreshWizardSummary();
          this.renderScenarioSnapshot();
          this.renderSelectedObjectEditor();
          this.refreshExportPreview();
          this.uiManager.showScreen("wizard");
          this.setStatus("Scenario editor build complete");
        } catch (error) {
          this.setStatus("Scenario editor build failed: " + String(error && error.message ? error.message : error));
        }
      }

      generateScenarioFromWizard() {
        this.buildScenarioFromWizard();
      }

      openIssueTarget(screenId, targetId) {
        if (screenId === "templates" && targetId) {
          this.selectTemplate(targetId, "templates");
          return;
        }
        if (screenId) {
          this.uiManager.showScreen(screenId);
        }
      }

      getScenarioValidation() {
        return this.kernel.validateScenario(this.state.currentScenario);
      }

      refreshValidationSummary(importErrorMessage = "") {
        const summary = document.getElementById("validation-summary");
        const validation = this.getScenarioValidation();
        const errors = validation.issues.errors.slice();
        const warnings = validation.issues.warnings.slice();
        const notes = validation.issues.notes.slice();
        if (importErrorMessage) {
          errors.unshift({
            severity: "error",
            message: importErrorMessage,
            recommendedAction: "Correct the import payload and try again.",
            targetScreen: "export",
            targetLabel: "Open export"
          });
        }

        const statusClass = errors.length ? "validation-error" : (warnings.length ? "validation-warning" : "validation-ok");
        const statusText = errors.length ? "Validation blocked" : (warnings.length ? "Validation warnings" : "Validation passed");
        const renderIssues = (issues, emptyText) => issues.length
          ? ("<div class=\"issue-list\">" + issues.map((issue, index) => (
              "<div class=\"issue-card " + escapeHtml(issue.severity) + "\">" +
                "<div class=\"issue-severity\">" + escapeHtml(issue.severity) + "</div>" +
                "<h4>" + escapeHtml(issue.message) + "</h4>" +
                (issue.recommendedAction ? ("<div class=\"issue-meta\">" + escapeHtml(issue.recommendedAction) + "</div>") : "") +
                ((issue.targetScreen || issue.targetId)
                  ? ("<div class=\"actions\"><button class=\"button-link validation-jump-btn\" data-target-screen=\"" + escapeHtml(issue.targetScreen || "") + "\" data-target-id=\"" + escapeHtml(issue.targetId || "") + "\">" + escapeHtml(issue.targetLabel || "Open editor") + "</button></div>")
                  : "") +
              "</div>"
            )).join("") + "</div>")
          : "<div class=\"validation-ok\">" + escapeHtml(emptyText) + "</div>";

        summary.innerHTML =
          "<div class=\"validation-box\">" +
            "<h3 class=\"" + statusClass + "\">" + escapeHtml(statusText) + "</h3>" +
            "<div style=\"color: var(--muted);\">Blockers: " + errors.length + " | Warnings: " + warnings.length + " | Notes: " + notes.length + "</div>" +
          "</div>" +
          "<div class=\"validation-box\">" +
            "<h4 class=\"validation-error\">Blockers</h4>" +
            renderIssues(errors, "No blocking errors.") +
          "</div>" +
          "<div class=\"validation-box\">" +
            "<h4 class=\"validation-warning\">Warnings</h4>" +
            renderIssues(warnings, "No heuristic warnings.") +
          "</div>" +
          "<div class=\"validation-box\">" +
            "<h4 class=\"validation-ok\">Scenario Quality Notes</h4>" +
            renderIssues(notes, "No additional notes.") +
          "</div>";

        summary.querySelectorAll(".validation-jump-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.openIssueTarget(button.dataset.targetScreen || "", button.dataset.targetId || "");
          });
        });

        const statusNode = document.getElementById("status-text");
        statusNode.classList.remove("status-ok", "status-warning", "status-error");
        statusNode.classList.add(errors.length ? "status-error" : (warnings.length ? "status-warning" : "status-ok"));
        return validation;
      }

      clearResults() {
        document.getElementById("queue-text").textContent = "0";
        document.getElementById("seed-text").textContent = "-";
        this.state.singleRun = null;
        this.state.monteCarloRows = [];
        this.state.currentFrame = null;
        this.state.currentReport = null;
        this.state.selectedMapEntity = null;
        this.renderer.setSelection(null);
        this.updateRunMetrics(null);
        this.updateLog([]);
        this.updateSingleRunReport(null);
        this.updateMonteCarloReport([]);
        this.renderEventTimeline(null);
        this.renderFailureDrivers();
        this.refreshLiveAnalysisSummary();
        this.setStatus("Ready");
        this.setPlaybackStatus("Idle");
        this.refreshExportPreview();
        this.updateMapSelectionChip();
      }

      renderScenarioModel(scenario, options = {}) {
        const preserveSelection = options.preserveSelection !== false;
        this.renderer.setScenario(scenario);
        document.getElementById("map-width-input").value = scenario.environment.mapWidthMeters ?? 1080;
        const frame = {
          timeSec: 0,
          reason: "scenario-preview",
          objects: scenario.instances.map((instance) => ({
            id: instance.id,
            name: instance.name,
            side: instance.side,
            roles: this.kernel.deepClone(instance.roles),
            x: instance.posX,
            y: instance.posY,
            z: instance.posZ,
            sensors: this.kernel.deepClone((scenario.templates.find((template) => template.id === instance.templateId)?.components.sensors) || []),
            effectors: this.kernel.deepClone((scenario.templates.find((template) => template.id === instance.templateId)?.components.effectors) || []),
            currentHeadingDeg: null,
            behaviorState: "Preview",
            destroyed: false,
            status: "Active"
          })),
          tracks: []
        };
        this.state.currentFrame = frame;
        this.state.currentReport = { scenarioName: scenario.metadata.name, targetDestroyed: false };
        this.renderer.setSelection(preserveSelection ? this.state.selectedMapEntity : null);
        this.renderer.draw(frame, this.state.currentReport);
      }

      renderScenarioSnapshot() {
        this.syncPlaceholderCards();
        this.renderScenarioModel(this.state.currentScenario, { preserveSelection: true });
      }

      stopPlayback() {
        if (this.state.playbackTimer) {
          window.clearInterval(this.state.playbackTimer);
          this.state.playbackTimer = null;
        }
      }

      playFrames(frames, report) {
        this.stopPlayback();
        if (!frames || !frames.length) {
          return;
        }
        this.state.currentReport = report;
        let index = 0;
        this.setPlaybackStatus("Playing");
        this.state.currentFrame = frames[0];
        this.renderer.setSelection(this.state.selectedMapEntity);
        this.renderer.draw(frames[0], report);
        this.state.playbackTimer = window.setInterval(() => {
          this.state.currentFrame = frames[index];
          this.renderer.setSelection(this.state.selectedMapEntity);
          this.renderer.draw(frames[index], report);
          index += 1;
          if (index >= frames.length) {
            this.stopPlayback();
            this.setPlaybackStatus("Complete");
          }
        }, 260);
      }

      async importScenarioFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }

        try {
          const text = await file.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (parseError) {
            throw new Error("Malformed JSON: " + parseError.message);
          }

          const validation = this.kernel.validateScenario(parsed);
          const normalized = validation.scenario;
          if (!normalized.metadata.name || normalized.metadata.name === "C-sUAS Tactical Simulator") {
            normalized.metadata.name = file.name.replace(/\.json$/i, "");
          }
          const normalizedChanged = JSON.stringify(parsed) !== JSON.stringify(normalized);
          this.state.currentScenario = normalized;
          this.state.originalScenarioPayloadText = text;
          this.state.scenarioExportSource = "normalized";
          document.getElementById("scenario-export-source").value = "normalized";
          this.state.lastImportSummary = {
            source: file.name,
            templateCount: normalized.templates.length,
            instanceCount: normalized.instances.length,
            normalizedChanged,
            dirty: false
          };
          this.state.selectedTemplateId = normalized.templates[0]?.id || null;
          this.updateScenarioLabel();
          this.syncPlaceholderControls();
          this.stopPlayback();
          this.clearResults();
          this.refreshValidationSummary();
          this.refreshImportSummary();
          this.renderTemplateBuilder();
          this.renderRosterEditor();
          this.renderTerrainEditor();
          this.renderWizardBlueAssets();
          this.renderWizardThreatGroups();
          this.refreshWizardSummary();
          this.renderScenarioSnapshot();
          this.renderSelectedObjectEditor();
          this.refreshExportPreview();
          this.setStatus(validation.valid
            ? ("Loaded scenario " + normalized.metadata.name)
            : ("Loaded scenario with validation issues: " + normalized.metadata.name));
        } catch (error) {
          this.setStatus("Scenario load failed");
          const message = String(error && error.message ? error.message : error);
          this.refreshValidationSummary(message);
          this.setExportPreview(message);
        } finally {
          event.target.value = "";
        }
      }

      exportCurrentScenario() {
        this.state.exportTab = "scenario";
        this.refreshExportPreview();
        const payload = document.getElementById("export-preview").value;
        const suffix = this.state.scenarioExportSource === "original" && this.state.originalScenarioPayloadText ? "_original" : "_scenario";
        downloadText(buildSafeFileStem(this.state.currentScenario.metadata.name) + suffix + ".json", payload, "application/json;charset=utf-8");
      }

      async runSingleScenario() {
        const validation = this.refreshValidationSummary();
        if (!validation.valid) {
          this.setStatus("Fix validation errors before running");
          return;
        }
        this.setBusy(true);
        this.setStatus("Running single scenario");
        this.setPlaybackStatus("Computing");
        this.stopPlayback();

        const result = this.simulationManager.run({
          seed: Math.floor((Date.now() % 2147483647)),
          captureFrames: true,
          scenario: this.state.currentScenario
        });

        this.state.singleRun = result;
        document.getElementById("queue-text").textContent = String(result.report.eventCount);
        document.getElementById("seed-text").textContent = String(result.report.seed);
        this.updateRunMetrics(result.report);
        this.updateLog(result.report.logs);
        this.updateSingleRunReport(result.report);
        this.renderEventTimeline(result.report);
        this.renderFailureDrivers();
        this.refreshLiveAnalysisSummary();
        this.playFrames(result.report.frames, result.report);
        this.refreshExportPreview();
        this.uiManager.showScreen("report");
        this.setStatus("Single scenario complete");
        this.setBusy(false);
      }

      async runMonteCarlo() {
        const validation = this.refreshValidationSummary();
        if (!validation.valid) {
          this.setStatus("Fix validation errors before Monte Carlo");
          return;
        }
        const iterations = this.kernel.clamp(Number(document.getElementById("monte-carlo-count").value) || 1, 1, 250);
        const baseSeed = Math.floor((Date.now() % 2147483647));
        this.setBusy(true);
        this.setStatus("Running Monte Carlo");
        this.setPlaybackStatus("Idle");
        document.getElementById("seed-text").textContent = String(baseSeed);

        try {
          this.state.monteCarloRows = await this.runMonteCarloOffThread(iterations, baseSeed);
          this.updateMonteCarloReport(this.state.monteCarloRows);
          this.renderFailureDrivers();
          this.refreshExportPreview();
          this.uiManager.closeAllSideTrays();
          this.uiManager.showScreen("report");
          this.setStatus("Monte Carlo complete");
        } catch (error) {
          this.setStatus("Monte Carlo failed");
          this.setExportPreview(String(error && error.message ? error.message : error));
        } finally {
          this.setBusy(false);
        }
      }

      runMonteCarloOffThread(iterations, baseSeed) {
        if (typeof Worker === "undefined") {
          return Promise.resolve(this.monteCarloManager.run(iterations, {
            baseSeed,
            scenario: this.state.currentScenario,
            onProgress: (completed, total) => {
              this.setStatus("Monte Carlo " + completed + " / " + total);
            }
          }));
        }

        return new Promise((resolve, reject) => {
          const worker = createMonteCarloWorker();
          this.state.monteCarloWorker = worker;

          worker.onmessage = (messageEvent) => {
            const message = messageEvent.data || {};
            if (message.type === "progress") {
              this.setStatus("Monte Carlo " + message.completed + " / " + message.total);
            } else if (message.type === "complete") {
              worker.terminate();
              this.state.monteCarloWorker = null;
              resolve(message.rows || []);
            } else if (message.type === "error") {
              worker.terminate();
              this.state.monteCarloWorker = null;
              reject(new Error(message.message || "Worker error"));
            }
          };

          worker.onerror = (error) => {
            worker.terminate();
            this.state.monteCarloWorker = null;
            reject(error);
          };

          worker.postMessage({
            type: "runMonteCarlo",
            iterations,
            baseSeed,
            scenario: this.state.currentScenario
          });
        });
      }

      updateRunMetrics(report) {
        const container = document.getElementById("run-metrics");
        const metrics = report ? [
          { label: "Detected", value: report.detected ? "Yes" : "No" },
          { label: "Ghost Tracks", value: report.ghostTracksGenerated },
          { label: "Classified", value: report.classified ? report.finalClassificationStatus : "No" },
          { label: "Identified", value: report.identified ? report.finalIdentificationStatus : "No" },
          { label: "Intent", value: report.intentAssessed ? report.finalIntentStatus : "No" },
          { label: "Tracks Dropped", value: report.tracksDropped },
          { label: "Shots Fired", value: report.shotsFired },
          { label: "HQ Survived", value: report.hqSurvived ? "Yes" : "No" },
          { label: "Weighted Score", value: report.weightedSurvivalScore },
          { label: "Successful Strikes", value: report.successfulStrikes ?? 0 },
          { label: "Spoof / Cyber", value: (report.spoofEvents ?? 0) + " / " + (report.cyberEvents ?? 0) },
          { label: "Destroyed", value: report.targetDestroyed ? "Yes" : "No" },
          { label: "Kill Time", value: report.killTimeSec ?? "-" }
        ] : [
          { label: "Detected", value: "-" },
          { label: "Classified", value: "-" },
          { label: "Identified", value: "-" },
          { label: "Intent", value: "-" },
          { label: "Tracks Dropped", value: "-" },
          { label: "Shots Fired", value: "-" },
          { label: "HQ Survived", value: "-" },
          { label: "Weighted Score", value: "-" },
          { label: "Successful Strikes", value: "-" },
          { label: "Spoof / Cyber", value: "-" },
          { label: "Destroyed", value: "-" },
          { label: "Kill Time", value: "-" }
        ];

        container.innerHTML = metrics.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
      }

      updateLog(logs) {
        const renderEntries = (entries) => entries.map((entry) => (
          "<div class=\"log-entry\"><span class=\"time\">T+" + Number(entry.timeSec).toFixed(2) + "s</span>" +
          "<span class=\"tag\">" + escapeHtml(entry.type || "event") + "</span> " +
          escapeHtml(entry.message) + "</div>"
        )).join("");
        const allContainer = document.getElementById("event-log");
        const blueContainer = document.getElementById("blue-feed");
        const redContainer = document.getElementById("red-feed");
        if (!logs || !logs.length) {
          const empty = "<div class=\"log-entry\">No events yet.</div>";
          allContainer.innerHTML = empty;
          blueContainer.innerHTML = empty;
          redContainer.innerHTML = empty;
          document.getElementById("blue-feed-count").textContent = "0";
          document.getElementById("red-feed-count").textContent = "0";
          return;
        }
        const blueEntries = logs.filter((entry) => entry.side === "Blue");
        const redEntries = logs.filter((entry) => entry.side === "Red");
        allContainer.innerHTML = renderEntries(logs);
        blueContainer.innerHTML = blueEntries.length ? renderEntries(blueEntries) : "<div class=\"log-entry\">No Blue-side events yet.</div>";
        redContainer.innerHTML = redEntries.length ? renderEntries(redEntries) : "<div class=\"log-entry\">No Red-side events yet.</div>";
        document.getElementById("blue-feed-count").textContent = String(blueEntries.length);
        document.getElementById("red-feed-count").textContent = String(redEntries.length);
        allContainer.scrollTop = 0;
        blueContainer.scrollTop = 0;
        redContainer.scrollTop = 0;
      }

      renderEventTimeline(report) {
        const container = document.getElementById("event-timeline-list");
        if (!report?.logs?.length) {
          container.innerHTML = "<div class=\"timeline-card\">Run a scenario to populate the timeline.</div>";
          return;
        }
        const interestingTypes = new Set(["detection", "track", "classification", "identification", "intent", "sensor", "c2", "effector", "damage", "movement"]);
        const entries = report.logs
          .filter((entry) => interestingTypes.has(entry.type))
          .slice(0, 40);
        container.innerHTML = entries.map((entry) => (
          "<div class=\"timeline-card\"><h4>T+" + Number(entry.timeSec).toFixed(2) + "s</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(entry.message) + "</div>" +
          "<small>" + escapeHtml((entry.side || "Neutral") + " | " + (entry.type || "event")) + "</small></div>"
        )).join("");
      }

      renderFailureDrivers() {
        const container = document.getElementById("failure-drivers-list");
        const cards = [];
        if (this.state.monteCarloRows.length) {
          const rows = this.state.monteCarloRows;
          const total = rows.length || 1;
          const drivers = [
            { label: "Threat Survived", count: rows.filter((row) => row.Threat_Destroyed !== "Yes").length },
            { label: "No Detection", count: rows.filter((row) => row.Detected !== "Yes").length },
            { label: "No Identification", count: rows.filter((row) => row.Identified !== "Yes").length },
            { label: "No Engagement", count: rows.filter((row) => row.Engaged !== "Yes").length },
            { label: "Track Drop", count: rows.filter((row) => Number(row.Tracks_Dropped || 0) > 0).length },
            { label: "HQ Lost", count: rows.filter((row) => Number(row.HQ_Survived || 0) !== 1).length }
          ]
            .sort((left, right) => right.count - left.count)
            .slice(0, 5);
          drivers.forEach((driver) => {
            cards.push(
              "<div class=\"timeline-card\"><h4>" + escapeHtml(driver.label) + "</h4><div class=\"summary-meta\">" +
              escapeHtml(String(driver.count)) + " of " + escapeHtml(String(total)) + " iterations (" +
              escapeHtml(String(this.kernel.round((driver.count / total) * 100, 1))) + "%)</div></div>"
            );
          });
        } else if (this.state.singleRun?.report) {
          const report = this.state.singleRun.report;
          const singleDrivers = [
            { label: "Detection", ok: report.detected, detail: report.detected ? "Threat detected" : "No detection candidate generated" },
            { label: "Identification", ok: report.identified, detail: report.identified ? report.finalIdentificationStatus : "No hostile ID achieved" },
            { label: "Engagement", ok: report.engaged, detail: report.engaged ? "Effector fired" : "No shot fired" },
            { label: "Outcome", ok: report.targetDestroyed, detail: report.targetDestroyed ? "Threat destroyed" : "Threat survived run window" },
            { label: "HQ", ok: report.hqSurvived, detail: report.hqSurvived ? "HQ survived" : "HQ was lost" }
          ];
          singleDrivers.forEach((driver) => {
            cards.push(
              "<div class=\"timeline-card\"><h4>" + escapeHtml(driver.label) + "</h4><div class=\"summary-meta\">" +
              escapeHtml(driver.detail) + "</div><small>" + escapeHtml(driver.ok ? "Nominal" : "Attention") + "</small></div>"
            );
          });
        } else {
          cards.push("<div class=\"timeline-card\">Run a scenario or Monte Carlo batch to populate failure-driver analysis.</div>");
        }
        container.innerHTML = cards.join("");
      }

      refreshLiveAnalysisSummary() {
        const container = document.getElementById("live-analysis-summary");
        const report = this.state.singleRun?.report || null;
        const summary = report ? [
          { label: "Assessment Snapshots", value: report.assessmentSnapshotCount || 0 },
          { label: "First Detection", value: report.firstDetectionTimeSec ?? "-" },
          { label: "Track Status", value: report.finalTrackStatus || "-" },
          { label: "Intent", value: report.finalIntentStatus || "-" },
          { label: "Spoof / Cyber", value: (report.spoofEvents ?? 0) + " / " + (report.cyberEvents ?? 0) }
        ] : [
          { label: "Assessment Snapshots", value: "-" },
          { label: "First Detection", value: "-" },
          { label: "Track Status", value: "-" },
          { label: "Intent", value: "-" },
          { label: "Spoof / Cyber", value: "-" }
        ];
        container.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
      }

      updateSingleRunReport(report) {
        const summaryContainer = document.getElementById("single-run-summary");
        const detailsContainer = document.getElementById("single-run-details");
        if (!report) {
          summaryContainer.innerHTML = "";
          detailsContainer.innerHTML = "";
          return;
        }

        const summary = [
          { label: "Detection", value: report.detected ? "Successful" : "Missed" },
          { label: "Ghost Tracks", value: report.ghostTracksGenerated },
          { label: "Identification", value: report.identified ? report.finalIdentificationStatus : "None" },
          { label: "Intent", value: report.intentAssessed ? report.finalIntentStatus : "None" },
          { label: "HQ Survived", value: report.hqSurvived ? "Yes" : "No" },
          { label: "Outcome", value: report.targetDestroyed ? "Threat destroyed" : "Threat survived" }
        ];
        summaryContainer.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");

        const details = [
          ["Scenario", report.scenarioName],
          ["Seed", report.seed],
          ["End time", report.endTimeSec + " s"],
          ["First detection time", report.firstDetectionTimeSec ?? "Not detected"],
          ["First detection range", report.firstDetectionRangeM ? report.firstDetectionRangeM + " m" : "Not detected"],
          ["Classification", report.finalClassificationStatus],
          ["Identification", report.finalIdentificationStatus],
          ["Intent", report.finalIntentStatus],
          ["Track status", report.finalTrackStatus],
          ["Ghost tracks generated", report.ghostTracksGenerated],
          ["Tracks dropped", report.tracksDropped],
          ["Kill time", report.killTimeSec ? report.killTimeSec + " s" : "No kill"],
          ["Blue assets survived", report.blueAssetsSurvived],
          ["Blue assets damaged", report.blueAssetsDamaged ?? 0],
          ["Blue assets destroyed", report.blueAssetsDestroyed ?? 0],
          ["Percent survived", this.kernel.round((report.percentSurvived || 0) * 100, 2) + "%"],
          ["Weighted survival score", report.weightedSurvivalScore],
          ["Threats destroyed", report.threatsDestroyed],
          ["Successful strikes", report.successfulStrikes ?? 0],
          ["Spoof events", report.spoofEvents ?? 0],
          ["Cyber events", report.cyberEvents ?? 0],
          ["Shots fired", report.shotsFired],
          ["Event count", report.eventCount],
          ["Assessment snapshots", report.assessmentSnapshotCount || 0],
          ["Final target status", report.finalTargetStatus]
        ];
        detailsContainer.innerHTML = details.map(([label, value]) => (
          "<li><span>" + escapeHtml(String(label)) + "</span><strong>" + escapeHtml(String(value)) + "</strong></li>"
        )).join("");
      }

      updateMonteCarloReport(rows) {
        const tableBody = document.getElementById("monte-carlo-table-body");
        const summaryContainer = document.getElementById("monte-carlo-summary");
        if (!rows.length) {
          tableBody.innerHTML = "";
          summaryContainer.innerHTML = "";
          return;
        }

        tableBody.innerHTML = rows.slice(0, 20).map((row) => (
          "<tr>" +
            "<td>" + escapeHtml(String(row.Iteration_ID)) + "</td>" +
            "<td>" + escapeHtml(String(row.Detected)) + "</td>" +
            "<td>" + escapeHtml(String(row.Identified)) + "</td>" +
            "<td>" + escapeHtml(String(row.Intent_Status)) + "</td>" +
            "<td>" + escapeHtml(String(row.Engaged)) + "</td>" +
            "<td>" + escapeHtml(String(row.Threat_Destroyed)) + "</td>" +
            "<td>" + escapeHtml(String(row.Tracks_Dropped)) + "</td>" +
            "<td>" + escapeHtml(String(row.First_Detection_Time_s || "-")) + "</td>" +
            "<td>" + escapeHtml(String(row.Kill_Time_s || "-")) + "</td>" +
            "<td>" + escapeHtml(String(row.Shots_Fired)) + "</td>" +
          "</tr>"
        )).join("");

        const total = rows.length;
        const detectionRate = rows.filter((row) => row.Detected === "Yes").length / total;
        const identificationRate = rows.filter((row) => row.Identified === "Yes").length / total;
        const killRate = rows.filter((row) => row.Threat_Destroyed === "Yes").length / total;
        const dropRate = rows.filter((row) => Number(row.Tracks_Dropped) > 0).length / total;
        const ghostRate = rows.filter((row) => Number(row.Ghost_Tracks_Generated) > 0).length / total;
        const averageShots = rows.reduce((sum, row) => sum + Number(row.Shots_Fired || 0), 0) / total;
        const hqSurvivalRate = rows.filter((row) => Number(row.HQ_Survived) === 1).length / total;
        const averageWeightedSurvival = rows.reduce((sum, row) => sum + Number(row.Weighted_Survival_Score || 0), 0) / total;

        const summary = [
          { label: "Iterations", value: total },
          { label: "Detection rate", value: this.kernel.round(detectionRate * 100, 1) + "%" },
          { label: "Identification rate", value: this.kernel.round(identificationRate * 100, 1) + "%" },
          { label: "Kill rate", value: this.kernel.round(killRate * 100, 1) + "%" },
          { label: "HQ survival", value: this.kernel.round(hqSurvivalRate * 100, 1) + "%" },
          { label: "Avg weighted survival", value: this.kernel.round(averageWeightedSurvival, 3) },
          { label: "Ghost-track rate", value: this.kernel.round(ghostRate * 100, 1) + "%" },
          { label: "Drop rate", value: this.kernel.round(dropRate * 100, 1) + "%" },
          { label: "Avg shots", value: this.kernel.round(averageShots, 2) }
        ];
        summaryContainer.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
      }

      refreshExportPreview() {
        const tab = this.state.exportTab || "scenario";
        const pretty = !!this.state.exportPrettyJson;
        const sourceSelect = document.getElementById("scenario-export-source");
        const source = this.state.scenarioExportSource === "original" && this.state.originalScenarioPayloadText ? "original" : "normalized";
        this.state.scenarioExportSource = source;
        sourceSelect.value = source;
        sourceSelect.disabled = !this.state.originalScenarioPayloadText;
        document.querySelectorAll("[data-export-tab]").forEach((button) => {
          button.classList.toggle("active", button.dataset.exportTab === tab);
        });

        let preview = "";
        if (tab === "report") {
          preview = this.state.singleRun
            ? JSON.stringify(this.state.singleRun.report, null, pretty ? 2 : 0)
            : "Run a single scenario to populate the report payload.";
        } else if (tab === "eventLog") {
          preview = this.state.singleRun
            ? JSON.stringify(this.state.singleRun.report.logs, null, pretty ? 2 : 0)
            : "Run a single scenario to populate the event log JSON.";
        } else if (tab === "monteCarlo") {
          preview = this.state.monteCarloRows.length
            ? this.kernel.rowsToCsv(this.state.monteCarloRows)
            : "Run Monte Carlo to populate the aggregate CSV preview.";
        } else {
          if (source === "original" && this.state.originalScenarioPayloadText) {
            try {
              const parsedOriginal = JSON.parse(this.state.originalScenarioPayloadText);
              preview = JSON.stringify(parsedOriginal, null, pretty ? 2 : 0);
            } catch (error) {
              preview = this.state.originalScenarioPayloadText;
            }
          } else {
            preview = JSON.stringify(this.state.currentScenario, null, pretty ? 2 : 0);
          }
        }
        this.setExportPreview(preview);
      }

      setExportPreview(text) {
        document.getElementById("export-preview").value = text;
      }
    }
