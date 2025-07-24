var body_tabla;
var fila_tabla;
var view_state;
var intentos = 0;
var regs_total = 0;
var regs_actual = 0;
var movimiento = "";
var clav_acceso = "";
var Continuar = false;
var tipo_dctos = 0;
var nume_fecha = "";
var nume_diass = "";
var nume_meses = "";
var nume_anios = "";
var name_files = "";
var url_links = "";
var text_body = "";
var tipo_files = "";
var tipo_elect = "E";
var tipo_emisi = "";
var tipo_docuc = "";
var tipo_docul = "";

function updateProgress(progress) {
    chrome.runtime.sendMessage({ action: 'updateProgress', progress: progress });
}

function Sleep(miliseconds) {
    var currentTime = new Date().getTime();
    while (currentTime + miliseconds >= new Date().getTime()) {
    }
 }

async function fetch_FilesDownloadNEW(urlSRI, frmBody, frmFile, nameFile) {
    let response = await fetch(urlSRI, {
        headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "es-ES,es;q=0.9,en;q=0.8",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "upgrade-insecure-requests": "1"
        },
        referrer: "",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: frmBody,
        method: "POST",
        mode: "cors",
        credentials: "include"
    });
    if (response.ok) {        
        if (frmFile == 'xml'){
            // await  Assuming the response is an XML string
            const data = await response.text(); 
            // Create a Blob object with the XML/PDF data and appropriate content type
            const blob = new Blob([data], { type: 'application/xml' });
            // Create a downloadable link element dynamically
            const downloadLink = document.createElement('a');
            downloadLink.href = window.URL.createObjectURL(blob); // Use window.URL.createObjectURL for a temporary URL
            downloadLink.download = nameFile //+ ".xml"; // Set the download name_files with .xml extension
            downloadLink.textContent = "Descargar Comprobante (XML)"; // Set the link text
            // Append the link to the DOM and trigger the download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            // Remove the link after download
            window.URL.revokeObjectURL(downloadLink.href);
            document.body.removeChild(downloadLink);
        }
        else if (frmFile == 'pdf'){
            // await  Assuming the response is an PDF string
            const data = await response.blob(); 
            // Create a Blob object with the XML/PDF data and appropriate content type
            const blob = new Blob([data], { type: 'application/pdf' });
            // Create a downloadable link element dynamically
            const downloadLink = document.createElement('a');
            downloadLink.href = window.URL.createObjectURL(blob); // Use window.URL.createObjectURL for a temporary URL
            downloadLink.download = nameFile //+ ".xml"; // Set the download name_files with .xml extension
            downloadLink.textContent = "Descargar Comprobante (PDF)"; // Set the link text
            // Append the link to the DOM and trigger the download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            // Remove the link after download
            window.URL.revokeObjectURL(downloadLink.href);
            document.body.removeChild(downloadLink);
        }
        else if (frmFile == 'sri'){
            // await  Assuming the response is an PDF string
            const data = await response.text(); 
            // Create a Blob object with the XML/PDF data and appropriate content type
            const blob = new Blob([data], { type: 'text/xml;charset=UTF-8' });
            // Create a downloadable link element dynamically
            const downloadLink = document.createElement('a');
            downloadLink.href = window.URL.createObjectURL(blob); // Use window.URL.createObjectURL for a temporary URL
            downloadLink.download = nameFile //+ ".xml"; // Set the download name_files with .xml extension
            downloadLink.textContent = "Descargar Comprobante (SRI)"; // Set the link text
            // Append the link to the DOM and trigger the download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            // Remove the link after download
            window.URL.revokeObjectURL(downloadLink.href);
            document.body.removeChild(downloadLink);
        }
    }
}

async function DescargarDocumentos(){
    if (movimiento == "REPAGINAR"){
        movimiento = "PROCESAR";
        if (document.querySelector("#frmPrincipal\\:tabla" + tipo_emisi + "_paginator_bottom")) {
            var bp = document.querySelector("#frmPrincipal\\:tabla" + tipo_emisi + "_paginator_bottom");
            var pa = bp.querySelector(".ui-paginator-current").textContent.match(/\d+/g)[1];
            if (pa > 1){
                updateProgress("Espere..Repaginado la cantidad visible...");
                var dmax = 300;
                var po = document.querySelector(".ui-paginator-rpp-options");
                var nd = po.querySelector("option");
                nd.value = dmax;
                nd.textContent = dmax;
                nd.selected = !0;
                var tmp_evento = new Event("change");
                po.dispatchEvent(tmp_evento);
                setTimeout(DescargarDocumentos, 4000); // Esperar a que la nueva página cargue
            }
            else{
                setTimeout(DescargarDocumentos, 1000); // Esperar a que la nueva página cargue
            }        
        }
    }
    else{
        Objs = !!document.getElementById('frmPrincipal:tabla' + tipo_emisi + '_data');
        if (Objs != null && Objs != false){ 
            body_tabla = document.getElementById('frmPrincipal:tabla' + tipo_emisi + '_data');
            regs_total = body_tabla.childElementCount;
            view_state = document.querySelector("#javax\\.faces\\.ViewState").value;
            if (regs_total > 0){
                intentos = 0;
                for (let i = 1; i <= regs_total; i++) {
                    try {
                        intentos++;
                        fila_tabla = body_tabla.getElementsByTagName("tr")[i-1];    
                        regs_actual = Number(fila_tabla.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
                        let M = body_tabla.querySelector(`tr[data-ri="${regs_actual}"]`);
                        let m = M.querySelectorAll('td[role="gridcell"]');
                        //clav_acceso = tipo_elect === 'R'
                        //? m[3].querySelector("div.ui-dt-c").textContent.trim().split("\n")[0].trim().slice(0, 52)
                        //: m[2].querySelector("div.ui-dt-c").textContent.trim().split("\n")[0].trim().slice(0, 52);
                        //name_files = (tipo_elect === 'R' ? "REC_" : "EMI_") + tipo_docuc + "_" + clav_acceso.substring(10, 23) + "_" + clav_acceso + "." + tipo_files;

                        if (tipo_elect == 'R'){
                            clav_acceso = m[3].querySelector("div.ui-dt-c").textContent.trim().split("\n")[0].trim().slice(0, 52);
                            name_files = "REC_" + clav_acceso.substring(10, 23) + "_" + tipo_docuc + "_" + clav_acceso.substring(24, 39) + "." + tipo_files;
                            if (tipo_files == 'xml'){
                                text_body = "frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=" + nume_anios;
                                text_body = text_body + "&frmPrincipal%3Ames=" + nume_meses;
                                text_body = text_body + "&frmPrincipal%3Adia=" + nume_diass;
                                text_body = text_body + "&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos;
                                text_body = text_body + "&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                                text_body = text_body + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual;
                                text_body = text_body + "%3AlnkXml=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3AlnkXml";
                            }
                            else if (tipo_files == 'sri'){
                                let text_IDhtml = m[3].querySelector("div.ui-dt-c").outerHTML.trim();
                                let nume_deta = text_IDhtml.substring((text_IDhtml.indexOf("j_idt")), (text_IDhtml.indexOf('" href'))); 
                                text_body = "javax.faces.partial.ajax=true&javax.faces.source=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&javax.faces.partial.execute=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&javax.faces.partial.render=" + tipo_docul + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta + "=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=" + nume_anios + "&frmPrincipal%3Ames=" + nume_meses + "&frmPrincipal%3Adia=" + nume_diass;
                                text_body = text_body + "&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos + "&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                            }
                            else if (tipo_files == 'pdf'){
                                text_body = "frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=" + nume_anios;
                                text_body = text_body + "&frmPrincipal%3Ames=" + nume_meses;
                                text_body = text_body + "&frmPrincipal%3Adia=" + nume_diass;
                                text_body = text_body + "&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos;
                                text_body = text_body + "&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                                text_body = text_body + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual;
                                text_body = text_body + "%3AlnkPdf=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3AlnkPdf";
                            }
                        }
                        else{
                            clav_acceso = m[2].querySelector("div.ui-dt-c").textContent.trim().split("\n")[0].trim().slice(0, 52);
                            name_files = "EMI_" + tipo_docuc + "_" + clav_acceso.substring(24, 39) + "_" + clav_acceso.substring(10, 23) + "." + tipo_files;
                            if (tipo_files == 'xml'){
                                text_body = "frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=" + nume_fecha.replaceAll("/", "%2F");
                                text_body = text_body + "&frmPrincipal%3AcmbEstadoAutorizacion=AUT";
                                text_body = text_body + "&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos;
                                text_body = text_body + "&frmPrincipal%3AcmbEstablecimiento=";
                                text_body = text_body + "&frmPrincipal%3AtxtPuntoEmision=";
                                text_body = text_body + "&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                                text_body = text_body + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual;
                                text_body = text_body + "%3AlnkXml=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3AlnkXml";                                
                            }
                            else if (tipo_files == 'sri'){
                                let text_IDhtml = m[2].querySelector("div.ui-dt-c").outerHTML.trim();
                                let nume_deta = text_IDhtml.substring((text_IDhtml.indexOf("j_idt")), (text_IDhtml.indexOf('" href'))); 
                                text_body = "javax.faces.partial.ajax=true&javax.faces.source=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&javax.faces.partial.execute=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&javax.faces.partial.render=" + tipo_docul + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta + "=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3A" + nume_deta;
                                text_body = text_body + "&frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=" + nume_fecha.replaceAll("/", "%2F");
                                text_body = text_body + "&frmPrincipal%3AcmbEstadoAutorizacion=AUT&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos;
                                text_body = text_body + "&frmPrincipal%3AcmbEstablecimiento=&frmPrincipal%3AtxtPuntoEmision=&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                            }
                            else if (tipo_files == 'pdf'){
                                text_body = "frmPrincipal=frmPrincipal&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=" + nume_fecha.replaceAll("/", "%2F");
                                text_body = text_body + "&frmPrincipal%3AcmbEstadoAutorizacion=AUT";
                                text_body = text_body + "&frmPrincipal%3AcmbTipoComprobante=" + tipo_dctos;
                                text_body = text_body + "&frmPrincipal%3AcmbEstablecimiento=";
                                text_body = text_body + "&frmPrincipal%3AtxtPuntoEmision=";
                                text_body = text_body + "&g-recaptcha-response=&javax.faces.ViewState=" + view_state;
                                text_body = text_body + "&frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual;
                                text_body = text_body + "%3AlnkPdf=frmPrincipal%3Atabla" + tipo_emisi + "%3A" + regs_actual + "%3AlnkPdf";                                
                            }
                        }
                        console.log(text_body + "==" + tipo_files + "==" + name_files);
                        await fetch_FilesDownloadNEW(url_links, text_body, tipo_files, name_files);
                        updateProgress("Descargando archivos " + i + " de " + regs_total);
                        intentos = 0;
                    } 
                    catch (error) {
                        updateProgress("Reitentando descargar archivo " + i + "....");
                        console.error(`Error al descargar ${name_files}: ${error}. Reintentando...`);
                        if (intentos < 2){
                            i--; // Reintentos el mismo archivo
                        }
                    }
                }
    
                // Avanzar a la siguiente página si existe
                const PagSig = document.getElementsByClassName('ui-paginator-next ui-state-default ui-corner-all ui-state-disabled');
                if (PagSig.length == 0) {
                    updateProgress("Cambiando  a la siguiente pagina....");
                    console.log('Avanzando a la siguiente página');
                    document.getElementsByClassName('ui-icon ui-icon-seek-next')[0].click();
                    setTimeout(DescargarDocumentos, 4000); // Esperar a que la nueva página cargue
                }
                else{
                    updateProgress("Terminado... :-)");
                    console.log("Ya no hay mas paginas..!!");
                    Sleep(3000);
                    alert("Proceso Concluido.!!");
                    updateProgress("...");
                    window.location.reload();
                }    
            }
        }       
    }
}

chrome.runtime.onMessage.addListener(gotMessage);

function gotMessage(message, sender, sendResponse){
    console.log("EXTENSION CHROME");
    console.log("Ing. Maria Loor y/o Ing. Javier Veliz.");
    console.log("www.srianexos.com");

    if(message.chkPaginar == 'SI')
        movimiento = "REPAGINAR";
    else
        movimiento = "PROCESAR";
    tipo_files = message.cmbDescarg;

    Continuar = false;
    let Objs = !!document.getElementById('frmPrincipal:tablaCompRecibidos_data');
    if (Objs == null || Objs == false){        
        Objs = !!document.getElementById('frmPrincipal:tablaCompEmitidos_data');
        if (Objs == null || Objs == false){
            console.log("NO hay documentos para descargar..!!");
            alert("No hay documentos para descargar..!!");
        }
        else{
            Continuar = true;
            tipo_elect = "E";
            tipo_emisi = "CompEmitidos";
            nume_fecha = document.getElementById("frmPrincipal:calendarFechaDesde_input").value;
            url_links = "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recuperarComprobantes.jsf";
            if (tipo_files == 'xml'){
                Continuar = false;
                alert("Los archivos XML emitidos no estan disponibles para descargar..!!");
            }
        }
    }
    else{
        Continuar = true;
        tipo_elect = "R";
        tipo_emisi = "CompRecibidos";
        nume_meses = document.getElementById("frmPrincipal:mes").value;
        nume_diass = document.getElementById("frmPrincipal:dia").value;
        nume_anios = document.getElementById("frmPrincipal:ano").value;
        url_links = "https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf";
    }
    if (Continuar == true){
        tipo_dctos = Number(document.getElementById("frmPrincipal:cmbTipoComprobante").value);            
        if (tipo_dctos == 1){
            tipo_docuc = "FAC";
            tipo_docul = "form-detalle-factura%3Apanel-detalle-factura"; 
        }
        else if (tipo_dctos == 2){
            tipo_docuc = "LIQ";
            tipo_docul = "form-detalle-liquidacionCompra%3Apanel-detalle-liquidacionCompra";
        }
        else if (tipo_dctos == 3){
            tipo_docuc = "CRE";
            tipo_docul = "form-detalle-nota-credito%3Apanel-detalle-nota-credito";
        }
        else if (tipo_dctos == 4){
            tipo_docuc = "DEB";
            tipo_docul = "form-detalle-nota-debito%3Apanel-detalle-nota-debito";
        }
        else if (tipo_dctos == 5){
            tipo_docuc = "GRM";
            tipo_docul = "form-detalle-guia-remision%3Apanel-detalle-guia-remision";
        }
        else if (tipo_dctos == 6){
            tipo_docuc = "RET";
            tipo_docul = "form-detalle-comprobante-retencion%3Apanel-detalle-comprobante-retencion";
        }
        else{
            tipo_docuc = "NPI";
            tipo_docul = "";
        }
        DescargarDocumentos();    
    }
}