// Esta extension permite descargar documentos electronicos desde el sitio web del SRI
// Contactos: Ing. Maria Loor y/o Ing. Javier Veliz
// www.srianexos.com / jvelizn@srianexos.com
// whatsApp 0989005060 / Manta - Manabi - Ecuador

function Procesar(){
  var estadoPAG = "NO";
  var tpDescarga = "xml";
  if (document.getElementById('chkPage').checked) {
    estadoPAG = "SI";
  }
  
  tpDescarga = document.getElementById('tipoFile').value;

  chrome.tabs.query({active: true, currentWindow: true}, goTabs);
  function goTabs(tabs){
    let msg = {
      website: "SRI Anexos - www.srianexos.com",
      cmbDescarg: tpDescarga,
      chkPaginar: estadoPAG
    }
    chrome.tabs.sendMessage(tabs[0].id, msg);
  }
}

function decodeUTF8(utftext) {
  var string = "";
  var i = 0;
  var c = c1 = c2 = c3 = 0;

  while (i < utftext.length) {
    c = utftext.charCodeAt(i);

    if (c < 128) {
      string += String.fromCharCode(c);
      i++;
    } else if (c > 191 && c < 224) {
      c2 = utftext.charCodeAt(i + 1);
      string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    } else {
      c2 = utftext.charCodeAt(i + 1);
      c3 = utftext.charCodeAt(i + 2);
      string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }
  }
  return string;
}

function ExtraeNodoXML(Cadena, Nodo){
  var Inicio = null;
  var Fin = null;
  Resultado = "";
  Inicio = Cadena.search("<" + Nodo + ">");
  Fin = Cadena.search("</" + Nodo + ">");
  if ((Inicio >= 0) && (Fin > Inicio)){
      Resultado = Cadena.substr((Inicio + (Nodo.length + 2)), Fin-(Inicio + (Nodo.length + 2)));
  }
  return Resultado;
}

window.onload = function() {
  document.getElementById('btnProcess').onclick = Procesar;

  let cerrar = document.querySelectorAll(".close")[0];
  let abrir = document.querySelectorAll(".abrirModal")[0];
  let modal = document.querySelectorAll(".modal")[0];
  let modalC = document.querySelectorAll(".modal-container")[0];
  abrir.addEventListener("click", function(e){
    document.body.style.height = "400px";
    e.preventDefault();
    modalC.style.opacity = "1";
    modalC.style.visibility = "visible";
    modal.classList.toggle("modal-close");
  });
  cerrar.addEventListener("click", function(e){
    modal.classList.toggle("modal-close");
    document.body.style.height = "190px";
    setTimeout(function(){
      modalC.style.opacity = "0";
      modalC.style.visibility = "hidden";
    }, 900);
  });
  window.addEventListener("click", function(e){
    if (e.target == modalC) {
      modal.classList.toggle("modal-close");
      document.body.style.height = "190px";
      setTimeout(function(){
        modalC.style.opacity = "0";
        modalC.style.visibility = "hidden";
      }, 700);
    }
  })

  let titulo2 = "Reina Valera 1960";
  let versiculo2 = "Deuteronomio 8. 17";
  let parrafo2 = "No digas para tus adentros:" + String.fromCharCode(13);
  parrafo2 = parrafo2 + "Con mi propia fuerza" + String.fromCharCode(13);
  parrafo2 = parrafo2 + "y el poder de mi mano" + String.fromCharCode(13);
  parrafo2 = parrafo2 + "me he creado estas riquezas." + String.fromCharCode(13) + String.fromCharCode(13);
  parrafo2 = parrafo2 + "Sino acuerdate de tu Dios," + String.fromCharCode(13);
  parrafo2 = parrafo2 + "que es quien te da la fuerza necesaria" + String.fromCharCode(13);
  parrafo2 = parrafo2 + "para crear la riqueza." + String.fromCharCode(13);

  var allText = "";
  var filename = "https://www.multiempresarios.com/Plantillas/Biblia/biblia.php?codApp=eLoad";
  var rawFile = new XMLHttpRequest();
  rawFile.open("GET", filename, true);
  rawFile.onreadystatechange = function() {
    if (rawFile.readyState === 4 && rawFile.status==200) {
      allText = atob(rawFile.responseText);
      let xmlResult = ExtraeNodoXML(allText, "evangelio");
      if (xmlResult.length > 5){
        titulo2 = decodeUTF8(ExtraeNodoXML(allText, "titulo"));
        versiculo2 = decodeUTF8(ExtraeNodoXML(allText, "versiculo"));
        parrafo2 = decodeUTF8(ExtraeNodoXML(allText, "evangelio"));

        document.getElementById("titulo1").innerHTML = titulo2;
        document.getElementById("txtbiblia1").innerHTML = versiculo2 + String.fromCharCode(13) + parrafo2;
        document.getElementById("titulo2").innerHTML = titulo2;
        document.getElementById("versiculo2").innerHTML = versiculo2;
        document.getElementById("txtbiblia2").innerHTML = parrafo2;
      }
      else{
        document.getElementById("titulo1").innerHTML = titulo2;
        document.getElementById("txtbiblia1").innerHTML = versiculo2 + String.fromCharCode(13) + parrafo2;
        document.getElementById("titulo2").innerHTML = titulo2;
        document.getElementById("versiculo2").innerHTML = versiculo2;
        document.getElementById("txtbiblia2").innerHTML = parrafo2;
      }
    }
    else{
      document.getElementById("titulo1").innerHTML = titulo2;
      document.getElementById("txtbiblia1").innerHTML = versiculo2 + String.fromCharCode(13) + parrafo2;
      document.getElementById("titulo2").innerHTML = titulo2;
      document.getElementById("versiculo2").innerHTML = versiculo2;
      document.getElementById("txtbiblia2").innerHTML = parrafo2;
    }
  }
  rawFile.send();
}

setInterval(function() {
  chrome.runtime.sendMessage({
      action: "obtenerEstado"
  }, function(r) {
    document.getElementById("progreso").innerHTML = r.res;
  })
}, 500);
