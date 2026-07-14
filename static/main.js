document.addEventListener("DOMContentLoaded", () => {
    // File references
    let prefacturaFile = null;
    let historiaFile = null;

    // DOM Elements
    const dropPrefactura = document.getElementById("dropPrefactura");
    const dropHistoria = document.getElementById("dropHistoria");
    const filePrefactura = document.getElementById("filePrefactura");
    const fileHistoria = document.getElementById("fileHistoria");
    const infoPrefactura = document.getElementById("infoPrefactura");
    const infoHistoria = document.getElementById("infoHistoria");
    
    const btnAudit = document.getElementById("btnAudit");
    const uploadSection = document.getElementById("uploadSection");
    const loadingState = document.getElementById("loadingState");
    const loadingText = document.getElementById("loadingText");
    const dashboardSection = document.getElementById("dashboardSection");
    
    const btnReset = document.getElementById("btnReset");
    const btnCopyMd = document.getElementById("btnCopyMd");
    const mdPreviewContent = document.getElementById("mdPreviewContent");

    // Modal Control Elements
    const datesModal = document.getElementById("datesModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalItemDesc = document.getElementById("modalItemDesc");
    const modalDatesList = document.getElementById("modalDatesList");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    function showDatesModal(name, dates) {
        modalTitle.textContent = "Registro de Fechas y Horas";
        modalItemDesc.textContent = name;
        modalDatesList.innerHTML = "";
        
        if (dates.length === 0 || (dates.length === 1 && dates[0] === "")) {
            modalDatesList.innerHTML = `<div class="date-item-card" style="opacity: 0.7; justify-content: center;">
                <span class="calendar-icon">📅</span>
                <span>Sin registros de fechas de aplicación en EMR</span>
            </div>`;
        } else {
            dates.forEach(d => {
                const card = document.createElement("div");
                card.className = "date-item-card";
                const parts = d.split(" ");
                const datePart = parts[0] || d;
                const timePart = parts[1] || "";
                card.innerHTML = `
                    <span class="calendar-icon">📅</span>
                    <div>
                        <span>${datePart}</span>
                        ${timePart ? ` a las <span class="time-value">${timePart}</span>` : ''}
                    </div>
                `;
                modalDatesList.appendChild(card);
            });
        }
        datesModal.classList.remove("hidden");
    }

    // Event delegation for dates button
    document.addEventListener("click", function(e) {
        const btn = e.target.closest(".btn-dates-action");
        if (btn) {
            const name = btn.getAttribute("data-name");
            const datesStr = btn.getAttribute("data-dates");
            const dates = datesStr ? datesStr.split(",") : [];
            showDatesModal(name, dates);
        }
    });

    // Close modal listeners
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", () => datesModal.classList.add("hidden"));
    }
    if (datesModal) {
        datesModal.addEventListener("click", (e) => {
            if (e.target === datesModal) {
                datesModal.classList.add("hidden");
            }
        });
    }

    // Loading messages
    const loadingMessages = [
        "Leyendo y extrayendo textos de los archivos PDF...",
        "Analizando códigos de procedimientos y consultas (CUPS)...",
        "Conciliando consumos de medicamentos intrahospitalarios...",
        "Calculando noches de estancia y analizando camas de Urgencias...",
        "Buscando notas de enfermería y validando cobro de insumos...",
        "Generando reporte de discrepancias financieras..."
    ];
    let loadingInterval = null;

    // Helper to format currency
    const formatCOP = (val) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    // Setup drag and drop events
    const setupDragAndDrop = (zone, input, onFileSelect) => {
        zone.addEventListener("click", () => input.click());
        
        input.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                onFileSelect(e.target.files[0]);
            }
        });

        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("dragover");
        });

        zone.addEventListener("dragleave", () => {
            zone.classList.remove("dragover");
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                onFileSelect(e.dataTransfer.files[0]);
            }
        });
    };

    // Handle prefactura selection
    setupDragAndDrop(dropPrefactura, filePrefactura, (file) => {
        prefacturaFile = file;
        infoPrefactura.textContent = `${file.name} (${(file.size/1024).toFixed(1)} KB)`;
        dropPrefactura.classList.add("has-file");
        checkInputs();
    });

    // Handle historia clinica selection
    setupDragAndDrop(dropHistoria, fileHistoria, (file) => {
        historiaFile = file;
        infoHistoria.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
        dropHistoria.classList.add("has-file");
        checkInputs();
    });

    // Verify if both files are uploaded
    const checkInputs = () => {
        if (prefacturaFile && historiaFile) {
            btnAudit.disabled = false;
        } else {
            btnAudit.disabled = true;
        }
    };

    // Reset state
    const resetAudit = () => {
        prefacturaFile = null;
        historiaFile = null;
        filePrefactura.value = "";
        fileHistoria.value = "";
        infoPrefactura.textContent = "Arrastra el PDF de la factura aquí o haz clic";
        infoHistoria.textContent = "Arrastra el PDF de la historia aquí o haz clic";
        dropPrefactura.classList.remove("has-file");
        dropHistoria.classList.remove("has-file");
        btnAudit.disabled = true;
        
        dashboardSection.classList.add("hidden");
        uploadSection.classList.remove("hidden");
    };
    btnReset.addEventListener("click", resetAudit);

    // Tab Navigation
    const tabs = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));
            
            tab.classList.add("active");
            const activeTabContent = document.getElementById(tab.dataset.tab);
            if (activeTabContent) {
                activeTabContent.classList.add("active");
            }
        });
    });

    // Copy Markdown Report
    btnCopyMd.addEventListener("click", () => {
        navigator.clipboard.writeText(mdPreviewContent.textContent)
            .then(() => {
                const originalText = btnCopyMd.textContent;
                btnCopyMd.textContent = "¡Copiado!";
                btnCopyMd.style.background = "#10b981";
                setTimeout(() => {
                    btnCopyMd.textContent = originalText;
                    btnCopyMd.style.background = "";
                }, 2000);
            })
            .catch(err => {
                alert("Error al copiar: " + err);
            });
    });

    // Run audit request
    btnAudit.addEventListener("click", async () => {
        if (!prefacturaFile || !historiaFile) return;

        // Display loading state
        uploadSection.classList.add("hidden");
        loadingState.classList.remove("hidden");
        
        // Animate loading text
        let msgIndex = 0;
        loadingText.textContent = loadingMessages[0];
        loadingInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % loadingMessages.length;
            loadingText.textContent = loadingMessages[msgIndex];
        }, 3000);

        // Build request body
        const formData = new FormData();
        formData.append("prefactura", prefacturaFile);
        formData.append("historia_clinica", historiaFile);

        try {
            const response = await fetch("/api/audit", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error("Error en el servidor al procesar el reporte.");
            }

            const data = await response.json();
            renderDashboard(data);
            
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al procesar la auditoría: " + error.message);
            loadingState.classList.add("hidden");
            uploadSection.classList.remove("hidden");
        } finally {
            clearInterval(loadingInterval);
            loadingState.classList.add("hidden");
        }
    });

    // Render results in dashboard
    const renderDashboard = (data) => {
        // 1. Render Metrics
        document.getElementById("metricDates").textContent = `${data.summary.admission_date} - ${data.summary.discharge_date}`;
        document.getElementById("metricNights").textContent = `${data.summary.nights} noches de estancia clínica`;
        document.getElementById("metricLoss").textContent = formatCOP(data.summary.total_missing_cost);
        
        const stayDiff = data.summary.stay_discrepancy;
        document.getElementById("metricStayDiff").textContent = `${stayDiff} días`;
        document.getElementById("metricStayDesc").textContent = stayDiff > 0 ? "Días no facturados" : "Estancias conciliadas";
        
        // Count total alerts
        let alertCount = 0;
        const criticalAlerts = [];

        // Count non-OK items in procedures, meds, supplies, estancias
        data.procedures.forEach(p => {
            if (p.status !== "OK") {
                alertCount++;
                criticalAlerts.push({
                    title: `Procedimiento ${p.status}: ${p.name}`,
                    desc: p.detail,
                    loss: p.missing_cost,
                    type: p.status === "FALTANTE" ? "danger" : "warning"
                });
            }
        });

        data.estancias.forEach(e => {
            if (e.status !== "OK") {
                alertCount++;
                criticalAlerts.push({
                    title: `Estancia en observación omitida`,
                    desc: e.detail,
                    loss: e.missing_cost,
                    type: "warning"
                });
            }
        });

        data.medications.forEach(m => {
            if (m.status !== "OK") {
                alertCount++;
                criticalAlerts.push({
                    title: `Fármaco ${m.status}: ${m.name}`,
                    desc: m.detail,
                    loss: m.missing_cost,
                    type: "warning"
                });
            }
        });

        data.supplies.forEach(s => {
            if (s.status !== "OK") {
                alertCount++;
                criticalAlerts.push({
                    title: `Insumo ${s.status}: ${s.name}`,
                    desc: s.detail,
                    loss: s.missing_cost,
                    type: s.status === "FALTANTE" ? "danger" : "warning"
                });
            }
        });

        document.getElementById("metricAlerts").textContent = alertCount;

        // 2. Render Chart
        const total = data.summary.total_missing_cost || 1; // avoid divide by zero
        const procPct = (data.summary.missing_procedures_cost / total) * 100;
        const stayPct = (data.estancias.reduce((acc, curr) => acc + curr.missing_cost, 0) / total) * 100;
        const medPct = (data.summary.missing_meds_cost / total) * 100;
        const supPct = (data.summary.missing_supplies_cost / total) * 100;

        document.querySelector(".proc-bar").style.width = `${procPct}%`;
        document.querySelector(".stay-bar").style.width = `${stayPct}%`;
        document.querySelector(".med-bar").style.width = `${medPct}%`;
        document.querySelector(".sup-bar").style.width = `${supPct}%`;

        document.getElementById("valProcLoss").textContent = formatCOP(data.summary.missing_procedures_cost);
        document.getElementById("valStayLoss").textContent = formatCOP(data.estancias.reduce((acc, curr) => acc + curr.missing_cost, 0));
        document.getElementById("valMedLoss").textContent = formatCOP(data.summary.missing_meds_cost);
        document.getElementById("valSupLoss").textContent = formatCOP(data.summary.missing_supplies_cost);

        // 3. Render Alerts List
        const alertsList = document.getElementById("summaryAlertsList");
        alertsList.innerHTML = "";
        if (criticalAlerts.length === 0) {
            alertsList.innerHTML = `<li class="file-info" style="text-align: center; padding: 2rem;">No se encontraron discrepancias. Todo coincide perfectamente.</li>`;
        } else {
            criticalAlerts.forEach(al => {
                const li = document.createElement("li");
                li.className = `alert-item ${al.type}`;
                li.innerHTML = `
                    <div class="alert-content">
                        <div class="alert-title">${al.title}</div>
                        <div class="alert-desc">${al.desc}</div>
                    </div>
                    ${al.loss > 0 ? `<div class="alert-loss">-${formatCOP(al.loss)}</div>` : ''}
                `;
                alertsList.appendChild(li);
            });
        }

        // 4. Render Procedures Table
        const procBody = document.getElementById("tableProcedimientosBody");
        procBody.innerHTML = "";
        data.procedures.forEach(p => {
            const tr = document.createElement("tr");
            const datesList = p.dates || [];
            const datesButtonHtml = `<button class="btn-dates-action" data-name="${p.name}" data-dates="${datesList.join(',')}">📅 Ver Fechas (${datesList.length})</button>`;
                
            tr.innerHTML = `
                <td><strong>${p.code}</strong></td>
                <td><div style="font-weight: 500;">${p.name}</div></td>
                <td>${p.billed_qty}</td>
                <td>${p.hc_qty}</td>
                <td><span class="status-badge ${p.status.toLowerCase()}">${p.status}</span></td>
                <td>${p.detail || 'Coincide con historia clínica'}</td>
                <td class="${p.missing_cost > 0 ? 'text-danger' : 'text-success'}">
                    ${p.missing_cost > 0 ? `-${formatCOP(p.missing_cost)}` : '$0'}
                </td>
                <td>${datesButtonHtml}</td>
            `;
            procBody.appendChild(tr);
        });

        // 5. Render Stays Table
        const stayBody = document.getElementById("tableEstanciasBody");
        stayBody.innerHTML = "";
        data.estancias.forEach(e => {
            const tr = document.createElement("tr");
            const datesList = e.dates || [];
            const datesButtonHtml = `<button class="btn-dates-action" data-name="Estancia: ${e.observed_unit}" data-dates="${datesList.join(',')}">📅 Ver Fechas (${datesList.length})</button>`;
            
            tr.innerHTML = `
                <td><div style="font-weight: 500;">${e.period}</div></td>
                <td>${e.billed_stays}</td>
                <td>${e.hc_nights}</td>
                <td class="text-danger">${e.missing_days} días</td>
                <td>${e.billed_unit}</td>
                <td>${e.observed_unit}</td>
                <td><span class="status-badge discrepancia">${e.status}</span></td>
                <td class="text-danger">-${formatCOP(e.missing_cost)}</td>
                <td>${datesButtonHtml}</td>
            `;
            stayBody.appendChild(tr);
        });

        // 6. Render Medications Table
        const medBody = document.getElementById("tableMedicamentosBody");
        medBody.innerHTML = "";
        data.medications.forEach(m => {
            const diff = m.hc_qty - m.billed_qty;
            const tr = document.createElement("tr");
            const datesList = m.dates || [];
            const datesButtonHtml = `<button class="btn-dates-action" data-name="${m.name}" data-dates="${datesList.join(',')}">📅 Ver Fechas (${datesList.length})</button>`;
            
            tr.innerHTML = `
                <td><strong>${m.code}</strong></td>
                <td><div style="font-weight: 500;">${m.name}</div></td>
                <td>${m.billed_qty}</td>
                <td>${m.hc_qty}</td>
                <td class="${diff > 0 ? 'text-danger' : 'text-success'}">${diff > 0 ? `+${diff}` : diff}</td>
                <td><span class="status-badge ${m.status.toLowerCase()}">${m.status}</span></td>
                <td>${m.detail || 'Consumo conciliado'}</td>
                <td class="${m.missing_cost > 0 ? 'text-danger' : 'text-success'}">
                    ${m.missing_cost > 0 ? `-${formatCOP(m.missing_cost)}` : '$0'}
                </td>
                <td>${datesButtonHtml}</td>
            `;
            medBody.appendChild(tr);
        });

        // 7. Render Supplies Table
        const supBody = document.getElementById("tableSuministrosBody");
        supBody.innerHTML = "";
        data.supplies.forEach(s => {
            const tr = document.createElement("tr");
            const datesList = s.dates || [];
            const datesButtonHtml = `<button class="btn-dates-action" data-name="${s.name}" data-dates="${datesList.join(',')}">📅 Ver Fechas (${datesList.length})</button>`;
                
            tr.innerHTML = `
                <td><strong>${s.code}</strong></td>
                <td><div style="font-weight: 500;">${s.name}</div></td>
                <td>${s.billed_qty}</td>
                <td>${s.hc_qty}</td>
                <td><span class="status-badge ${s.status.toLowerCase()}">${s.status}</span></td>
                <td>${s.detail || 'Conciliado de forma correcta'}</td>
                <td class="${s.missing_cost > 0 ? 'text-danger' : 'text-success'}">
                    ${s.missing_cost > 0 ? `-${formatCOP(s.missing_cost)}` : '$0'}
                </td>
                <td>${datesButtonHtml}</td>
            `;
            supBody.appendChild(tr);
        });

        // 8. Render Markdown text
        mdPreviewContent.textContent = data.report_markdown;

        // Show Dashboard
        dashboardSection.classList.remove("hidden");
    };
});
