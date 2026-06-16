// --- ESTADO TEMPORAL EN MEMORIA (Ahora sincronizado con localStorage) ---
// Intentamos cargar lo que ya esté guardado; si no hay nada, empezamos con un array vacío []
let integrantes = localStorage.getItem('integrantes') ? JSON.parse(localStorage.getItem('integrantes')) : [];
let gastos = localStorage.getItem('gastos') ? JSON.parse(localStorage.getItem('gastos')) : [];

// --- ELEMENTOS DEL DOM ---
const inputNombre = document.getElementById('nombre-integrante');
const btnAgregarIntegrante = document.getElementById('btn-agregar-integrante');
const listaIntegrantes = document.getElementById('lista-integrantes');
const selectPagador = document.getElementById('pagador');
const formularioGasto = document.getElementById('formulario-gasto');
const listaGastos = document.getElementById('lista-gastos');
const divisionCuentas = document.getElementById('division-cuentas');

// --- ACCIÓN 1: AGREGAR INTEGRANTE ---
btnAgregarIntegrante.addEventListener('click', () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) return;

    // Evitar duplicados
    if (integrantes.some(i => i.nombre.toLowerCase() === nombre.toLowerCase())) {
        inputNombre.value = '';
        return;
    }

    const nuevoIntegrante = {
        id: integrantes.length + 1,
        nombre: nombre
    };
    integrantes.push(nuevoIntegrante);

    // PERSISTENCIA: Guardamos la lista de integrantes actualizada en el navegador
    localStorage.setItem('integrantes', JSON.stringify(integrantes));

    renderizarIntegrantes();
    actualizarSelectorPagadores();

    inputNombre.value = '';
});

inputNombre.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnAgregarIntegrante.click();
    }
});

function renderizarIntegrantes() {
    listaIntegrantes.innerHTML = '';
    integrantes.forEach(integrante => {
        const item = document.createElement('li');
        item.className = 'lista-integrante-item';
        item.innerHTML = `👤 ${integrante.nombre}`;
        listaIntegrantes.appendChild(item);
    });
}

function actualizarSelectorPagadores() {
    selectPagador.innerHTML = '<option value="">-- Selecciona quién pagó --</option>';
    integrantes.forEach(integrante => {
        const opcion = document.createElement('option');
        opcion.value = integrante.id;
        opcion.textContent = integrante.nombre;
        selectPagador.appendChild(opcion);
    });
}

// --- ACCIÓN 2: REGISTRAR UN GASTO ---
formularioGasto.addEventListener('submit', (e) => {
    e.preventDefault();

    const concepto = document.getElementById('concepto').value.trim();
    const monto = parseFloat(document.getElementById('monto').value);
    const pagadorId = parseInt(selectPagador.value);

    if (!concepto || isNaN(monto) || monto <= 0 || isNaN(pagadorId)) {
        return;
    }

    const pagador = integrantes.find(i => i.id === pagadorId);
    if (!pagador) return;

    // El gasto se reparte entre los que estén agregados en el momento actual
    const nuevoGasto = {
        id: gastos.length + 1,
        concepto: concepto,
        monto: monto,
        pagador: pagador,
        participantes: [...integrantes] // Copia de los integrantes actuales
    };

    gastos.push(nuevoGasto);

    // PERSISTENCIA: Guardamos la lista de gastos actualizada en el navegador
    localStorage.setItem('gastos', JSON.stringify(gastos));

    renderizarGastos();
    calcularYRenderizarBalances();

    formularioGasto.reset();
});

// --- RENDERIZAR GASTOS CON PANEL DETALLADO E INTERACTIVO ---
function renderizarGastos() {
    listaGastos.innerHTML = '';
    
    gastos.forEach((gasto, index) => {
        const divGasto = document.createElement('div');
        divGasto.className = 'contenedor-gasto';
        
        // Calcular cuota individual por este gasto
        const cuota = gasto.monto / gasto.participantes.length;

        // Generar lista de quién le debe a quién individualmente por ESTE gasto
        let desgloseHTML = '';
        gasto.participantes.forEach(p => {
            if (p.id !== gasto.pagador.id) {
                desgloseHTML += `
                    <li>
                        <span>👤 <strong>${p.nombre}</strong> le debe a ${gasto.pagador.nombre}</span>
                        <strong>$${cuota.toFixed(2)}</strong>
                    </li>
                `;
            } else {
                desgloseHTML += `
                    <li class="excluido">
                        <span>👤 <strong>${p.nombre}</strong> (Pagó el total)</span>
                        <strong>$0.00</strong>
                    </li>
                `;
            }
        });

        divGasto.innerHTML = `
            <div class="gasto-item-header" onclick="toggleDetalle(${index}, this)">
                <div class="gasto-info">
                    <h4>${gasto.concepto}</h4>
                    <span>Pagado por: <strong>${gasto.pagador.nombre}</strong></span>
                </div>
                <div class="gasto-monto-lado">
                    <span class="monto">$${gasto.monto.toFixed(2)}</span>
                    <span class="flecha-toggle">▼</span>
                </div>
            </div>
            <div class="gasto-detalle">
                <p>📋 <strong>Desglose de este pago:</strong> El monto de $${gasto.monto.toFixed(2)} se dividió equitativamente entre ${gasto.participantes.length} personas ($${cuota.toFixed(2)} c/u):</p>
                <ul>
                    ${desgloseHTML}
                </ul>
            </div>
        `;
        
        listaGastos.appendChild(divGasto);
    });
}

// Función global para manejar el efecto expandir/contraer
window.toggleDetalle = function(index, elementoHeader) {
    const contenedor = elementoHeader.parentElement;
    
    // Si ya está activo, lo cerramos
    if (contenedor.classList.contains('activo')) {
        contenedor.classList.remove('activo');
    } else {
        // Primero cerramos cualquier otro desglose abierto para que se vea más ordenado
        document.querySelectorAll('.contenedor-gasto').forEach(el => {
            el.classList.remove('activo');
        });
        // Abrimos el actual
        contenedor.classList.add('activo');
    }
}

// --- ACCIÓN 3: CALCULAR BALANCES FINALES (Mínima cantidad de transacciones) ---
function calcularYRenderizarBalances() {
    if (gastos.length === 0 || integrantes.length < 2) {
        divisionCuentas.innerHTML = 'Aún no hay suficientes datos para realizar cuentas. Agrega al menos 2 integrantes y un gasto.';
        divisionCuentas.className = 'alerta-resultado';
        return;
    }

    let balances = {};
    integrantes.forEach(i => {
        balances[i.nombre] = 0;
    });

    gastos.forEach(gasto => {
        const cuota = gasto.monto / gasto.participantes.length;
        
        balances[gasto.pagador.nombre] += gasto.monto;

        gasto.participantes.forEach(p => {
            balances[p.nombre] -= cuota;
        });
    });

    let deudores = [];
    let acreedores = [];

    for (let persona in balances) {
        let saldo = parseFloat(balances[persona].toFixed(4));
        if (saldo < -0.01) {
            deudores.push({ nombre: persona, saldo: Math.abs(saldo) });
        } else if (saldo > 0.01) {
            acreedores.push({ nombre: persona, saldo: saldo });
        }
    }

    let transacciones = [];
    let i = 0; 
    let j = 0; 

    while (i < deudores.length && j < acreedores.length) {
        let deudor = deudores[i];
        let acreedor = acreedores[j];

        let montoTransferido = Math.min(deudor.saldo, acreedor.saldo);

        transacciones.push({
            de: deudor.nombre,
            para: acreedor.nombre,
            monto: montoTransferido
        });

        deudor.saldo -= montoTransferido;
        acreedor.saldo -= montoTransferido;

        if (deudor.saldo < 0.01) i++;   
        if (acreedor.saldo < 0.01) j++; 
    }

    divisionCuentas.innerHTML = '';
    divisionCuentas.className = ''; 

    if (transacciones.length === 0) {
        divisionCuentas.innerHTML = '<div class="alerta-resultado">¡Todos están a mano! No hay deudas pendientes.</div>';
        return;
    }

    transacciones.forEach(t => {
        const item = document.createElement('div');
        item.className = 'transaccion-item';
        item.innerHTML = `<strong>${t.de}</strong> debe pagarle <strong>$${t.monto.toFixed(2)}</strong> a <strong>${t.para}</strong>`;
        divisionCuentas.appendChild(item);
    });
}

// --- CARGA INICIAL DE LA INTERFAZ ---
// Al abrir la aplicación, dibujamos todo lo que recuperamos del localStorage
renderizarIntegrantes();
actualizarSelectorPagadores();
renderizarGastos();
calcularYRenderizarBalances();