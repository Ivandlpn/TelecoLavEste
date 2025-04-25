// Definición de constantes y dimensiones
const CELL_SIZE = 16; // Tamaño de cada celda del día en px
const MONTH_PADDING_X = 10; // Espacio horizontal entre meses
const MONTH_PADDING_Y = 20; // Espacio vertical entre meses
const YEAR_PADDING_Y = 40; // Espacio vertical entre años contractuales
const MONTH_TITLE_HEIGHT = 20; // Altura reservada para el título del mes
const DAY_GRID_GAP = 1; // Espacio entre celdas del grid
const EMPTY_COLOR = '#eee'; // Color para 0 circulaciones o días sin datos

// Configuración para el mapa de nombres de meses abreviados a índices (0-basado)
const monthMap = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

// Selección de los contenedores principales
const visualizationContainer = d3.select('#visualization-container');
const tooltip = d3.select('#tooltip');

// Función principal asíncrona para cargar y procesar los datos
async function initializeVisualization() {
    try {
        // Cargar ambos archivos JSON simultáneamente
        const [rawData, specialDatesData] = await Promise.all([
            d3.json('datos.json'),
            d3.json('fechas_destacadas.json')
        ]);

        console.log("Datos crudos cargados:", rawData);
        console.log("Fechas destacadas cargadas:", specialDatesData);

        // 1. Procesar los datos crudos a una lista plana diaria
        const dailyData = processRawData(rawData);
        console.log("Datos diarios transformados:", dailyData);

        // 2. Procesar las fechas destacadas a un mapa para búsqueda rápida
        const specialDatesMap = processSpecialDates(specialDatesData);
        console.log("Mapa de fechas destacadas:", specialDatesMap);

        // 3. Calcular el dominio de circulaciones para la escala de color
        const allCirculations = dailyData.map(d => d.circulaciones).filter(c => c > 0); // Excluir 0 para la escala
        const minCirc = d3.min(allCirculations) || 1; // Mínimo debe ser al menos 1 si hay datos > 0
        const maxCirc = d3.max(allCirculations) || 1; // Máximo debe ser al menos 1

        console.log("Min circulaciones (excl. 0):", minCirc);
        console.log("Max circulaciones:", maxCirc);

        // 4. Crear la escala de color
        const colorScale = d3.scaleSequential()
            .domain([minCirc, maxCirc])
            .interpolator(d3.interpolateRgb('green', 'red')); // Escala de verde a rojo

        // Asignar color específico para 0 circulaciones
        colorScale.unknown(EMPTY_COLOR);


        // 5. Agrupar los datos por "Año Contractual" (Junio a Mayo)
        const dataByContractualYear = groupDataByContractualYear(dailyData);
        console.log("Datos agrupados por año contractual:", dataByContractualYear);

        // 6. Renderizar la visualización del calendario
        renderCalendar(visualizationContainer, dataByContractualYear, colorScale, specialDatesMap);

        // 7. Renderizar la leyenda de color
        renderLegend(d3.select('#legend'), colorScale, minCirc, maxCirc);

    } catch (error) {
        console.error("Error al cargar o procesar los datos:", error);
        visualizationContainer.html("<p>Error al cargar los datos. Por favor, verifica los archivos JSON.</p>");
    }
}

// --- Funciones de Procesamiento de Datos ---

function processRawData(data) {
    const dailyData = [];
    const dateFormatter = d3.timeFormat('%Y-%m-%d'); // Formato estándar para las fechas

    data.forEach(monthEntry => {
        const monthYearStr = monthEntry[""]; // Ej: "jun-13"
        if (!monthYearStr) {
            console.warn("Mes sin identificador encontrado, saltando:", monthEntry);
            return; // Saltar si no hay identificador de mes/año
        }

        const parts = monthYearStr.split('-');
        if (parts.length !== 2) {
             console.warn("Formato de mes/año incorrecto:", monthYearStr, ", saltando.");
             return;
        }

        const monthAbbr = parts[0];
        const yearTwoDigits = parts[1];

        const monthIndex = monthMap[monthAbbr];
        if (monthIndex === undefined) {
             console.warn("Nombre de mes desconocido:", monthAbbr, ", saltando.");
             return;
        }

        // Convertir año de dos dígitos a cuatro dígitos (asumiendo 20xx)
        const fullYear = 2000 + parseInt(yearTwoDigits, 10);

        // Iterar sobre los posibles días del mes (1 a 31)
        for (let day = 1; day <= 31; day++) {
            const dayKey = day.toString();
            const circulacionesStr = monthEntry[dayKey];

            // Solo procesar si hay una clave para el día (incluso si el valor es "")
            if (monthEntry.hasOwnProperty(dayKey)) {
                let circulaciones = 0;
                if (circulacionesStr !== "" && !isNaN(parseInt(circulacionesStr, 10))) {
                    circulaciones = parseInt(circulacionesStr, 10);
                }

                // Crear un objeto Date. D3 helpers son útiles aquí.
                // d3.timeParse ya maneja meses abreviados y años. Pero la estructura de datos es rara.
                // Crearemos el objeto Date directamente y validaremos si es necesario.
                const date = new Date(fullYear, monthIndex, day);

                // Opcional: Verificar si la fecha construida es válida para ese mes (ej: no 31 de abril)
                // Aunque si el dato original es "", ya lo interpretamos como 0,
                // la fecha debe existir en el calendario para posicionar la celda.
                // Un Date object con un día inválido (ej: new Date(2023, 3, 31) para abril)
                // automáticamente ajusta el día y mes (ej: a May 1). Esto NO es lo que queremos.
                // Queremos la fecha exacta que *debería* ser esa celda.
                // La validación es si monthEntry[dayKey] existe y no es "".
                // Si monthEntry[dayKey] ES "", significa que ese día en ese mes no tenía datos O no existía.
                // En ambos casos, 0 circulaciones es correcto. La fecha se construye con fullYear, monthIndex, day.

                 // Simple check: si el día es > 28, verificar que la fecha creada realmente cae en el mes esperado
                 // D3.timeDays(start, end) es mejor para generar los días reales de un mes/rango.
                 // Vamos a rehacer esto usando d3.timeDays para obtener las fechas válidas directamente.

            }
        }
    });

     // RE-IMPLEMENTACIÓN DEL PROCESAMIENTO USANDO D3.timeDays
     const flatData = [];
     const circulationsLookup = new Map(); // Mapa para buscar circulaciones por fecha 'YYYY-MM-DD'

     data.forEach(monthEntry => {
        const monthYearStr = monthEntry[""];
        if (!monthYearStr) return;
        const parts = monthYearStr.split('-');
        if (parts.length !== 2) return;

        const monthAbbr = parts[0];
        const yearTwoDigits = parts[1];
        const monthIndex = monthMap[monthAbbr];
        const fullYear = 2000 + parseInt(yearTwoDigits, 10);

        // Iterar sobre los posibles días 1 a 31 para crear el lookup
         for (let day = 1; day <= 31; day++) {
             const dayKey = day.toString();
             // Verificar si la clave numérica existe en el objeto del mes
             if (monthEntry.hasOwnProperty(dayKey)) {
                 const circulacionesStr = monthEntry[dayKey];
                 let circulaciones = 0;
                  if (circulacionesStr !== "" && !isNaN(parseInt(circulacionesStr, 10))) {
                     circulaciones = parseInt(circulacionesStr, 10);
                  }
                 // Usar un formato consistente para la clave (ej: 2013-06-01)
                 // Aunque la fecha puede ser inválida (ej. 31 de abril), guardamos el valor asociado a esa clave
                 // La validación real de la fecha para el calendario la hará D3.timeDays después.
                 const dateCandidate = new Date(fullYear, monthIndex, day);
                 const dateString = dateFormatter(dateCandidate); // Esto puede dar una fecha *incorrecta* si day es inválido
                 // Alternativa más robusta: generar todas las fechas *válidas* del mes y luego buscar el valor
             }
         }
     });

    // Nueva estrategia: Iterar sobre los meses del archivo y generar las fechas *válidas* para esos meses
    // Luego, para cada fecha válida, buscar su valor en el objeto original del mes.
     data.forEach(monthEntry => {
         const monthYearStr = monthEntry[""];
         if (!monthYearStr) return;
         const parts = monthYearStr.split('-');
         if (parts.length !== 2) return;

         const monthAbbr = parts[0];
         const yearTwoDigits = parts[1];
         const monthIndex = monthMap[monthAbbr];
         const fullYear = 2000 + parseInt(yearTwoDigits, 10);

         // Obtener el primer día y el último día del mes real
         const firstDayOfMonth = new Date(fullYear, monthIndex, 1);
         const lastDayOfMonth = new Date(fullYear, monthIndex + 1, 0); // Día 0 del siguiente mes es el último del actual

         // Generar todas las fechas válidas para este mes usando d3.timeDays
         const daysInMonth = d3.timeDays(firstDayOfMonth, d3.timeDay.offset(lastDayOfMonth, 1)); // Incluye el último día

         daysInMonth.forEach(date => {
             const day = date.getDate(); // Obtener el día del mes (1-31)
             const dayKey = day.toString();
             let circulaciones = 0; // Valor por defecto

             // Buscar el valor en el objeto original usando la clave del día
             if (monthEntry.hasOwnProperty(dayKey)) {
                 const circulacionesStr = monthEntry[dayKey];
                  if (circulacionesStr !== "" && !isNaN(parseInt(circulacionesStr, 10))) {
                     circulaciones = parseInt(circulacionesStr, 10);
                  }
             }
             // Si la clave no existe, o el valor es "", circulaciones sigue siendo 0.

             flatData.push({
                 date: date, // Objeto Date
                 circulaciones: circulaciones
             });
         });
     });

     // Asegurarse de que los datos están ordenados por fecha
     flatData.sort((a, b) => a.date - b.date);


    return flatData;
}


function processSpecialDates(data) {
    const specialDatesMap = new Map(); // Usar Map para mejor rendimiento en búsquedas
    data.forEach(entry => {
        // Asegurarse de que la fecha esté en un formato consistente (YYYY-MM-DD)
        const dateStr = entry.fecha; // Ya vienen en YYYY-MM-DD del JSON
        specialDatesMap.set(dateStr, entry.evento);
    });
    return specialDatesMap;
}

function groupDataByContractualYear(dailyData) {
    const years = new Map(); // Usar Map para mantener el orden de inserción si es necesario, o un objeto simple
    const yearFormatter = d3.timeFormat('%Y');
    const monthFormatter = d3.timeFormat('%m'); // 01-12

    dailyData.forEach(d => {
        const year = d.date.getFullYear();
        const month = d.date.getMonth(); // 0-11

        // Determinar el año contractual:
        // Si el mes es Junio (5) o posterior (hasta Mayo, 4), el año contractual es el año actual + el siguiente.
        // Si el mes es anterior a Junio (Enero a Mayo, 0-4), el año contractual es el año anterior + el actual.
        let contractualYearKey;
        if (month >= 5) { // Junio a Diciembre
            contractualYearKey = `${year}-${year + 1}`;
        } else { // Enero a Mayo
            contractualYearKey = `${year - 1}-${year}`;
        }

        if (!years.has(contractualYearKey)) {
            years.set(contractualYearKey, []);
        }
        years.get(contractualYearKey).push(d);
    });

     // Convertir el mapa a un array de objetos para facilitar la iteración en D3
     const sortedYears = Array.from(years.entries())
         .map(([key, values]) => ({ key, values }))
     // Ordenar los años contractuales (ej: "2013-2014" antes que "2014-2015")
         .sort((a, b) => parseInt(a.key.split('-')[0], 10) - parseInt(b.key.split('-')[0], 10));


    return sortedYears;
}


// --- Funciones de Renderizado ---

function renderCalendar(container, dataByContractualYear, colorScale, specialDatesMap) {
     // Limpiar contenedor previo
     container.selectAll('*').remove();

    const fullDateFormatter = d3.timeFormat('%A, %d de %B de %Y');
    const monthNameFormatter = d3.timeFormat('%B %Y');
    const dayOfWeekFormatter = d3.timeFormat('%w'); // Día de la semana, 0=Domingo, 6=Sábado
    const dateFormatter = d3.timeFormat('%Y-%m-%d'); // Para buscar en el mapa de fechas destacadas


     dataByContractualYear.forEach(yearData => {
         const yearKey = yearData.key; // Ej: "2013-2014"
         const yearValues = yearData.values; // Array de datos diarios para este año contractual

         // Crear un contenedor para este año contractual
         const yearDiv = container.append('div')
             .attr('class', 'contractual-year');

         yearDiv.append('h2')
             .attr('class', 'year-title')
             .text(`Año Contractual ${yearKey}`);

         // Calcular el total anual para este año contractual
         const yearTotal = d3.sum(yearValues, d => d.circulaciones);
          yearDiv.append('div')
              .attr('class', 'year-total')
              .text(`Total Año Contractual: ${yearTotal} circulaciones`);

         // Agrupar los datos de este año por mes (para el rendering interno)
         const dataByMonth = d3.group(yearValues, d => d.date.getMonth()); // Group by month index (0-11)

         // Renderizar meses en orden (Junio a Mayo)
         // Los meses del año contractual 2013-2014 son Jun 2013 (5) a Dic 2013 (11), y Ene 2014 (0) a May 2014 (4)
         const monthOrder = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

         monthOrder.forEach(monthIndex => {
             // Si no hay datos para este mes en este año contractual, saltar
             if (!dataByMonth.has(monthIndex)) {
                 // Opcional: renderizar un mes vacío si se desea consistencia visual
                 return;
             }

             const monthValues = dataByMonth.get(monthIndex);
             // monthValues contiene todos los días con datos para este mes.
             // Necesitamos generar *todos* los días del mes real para la cuadrícula.
             const anyDateInMonth = monthValues[0].date; // Usar cualquier fecha para obtener el año y mes
             const yearOfThisMonth = anyDateInMonth.getFullYear(); // Año real del mes (ej: 2013 o 2014)
             const firstDayOfMonth = new Date(yearOfThisMonth, monthIndex, 1);
             const lastDayOfMonth = new Date(yearOfThisMonth, monthIndex + 1, 0);

             // Generar todas las fechas válidas del mes
             const allDaysOfMonth = d3.timeDays(firstDayOfMonth, d3.timeDay.offset(lastDayOfMonth, 1));

             // Crear un mapa de datos para buscar rápidamente las circulaciones por fecha YYYY-MM-DD
             const monthDataLookup = new Map(monthValues.map(d => [dateFormatter(d.date), d.circulaciones]));

             // Calcular el total mensual
             const monthTotal = d3.sum(monthValues, d => d.circulaciones);

             // Crear contenedor para el mes
             const monthDiv = yearDiv.append('div')
                 .attr('class', 'month');

             monthDiv.append('div')
                 .attr('class', 'month-title')
                 .text(monthNameFormatter(firstDayOfMonth)); // Muestra "Junio 2013", "Julio 2013", etc.

              monthDiv.append('div')
                   .attr('class', 'month-total')
                   .text(`Total: ${monthTotal}`);


             const dayGrid = monthDiv.append('div')
                 .attr('class', 'day-grid')
                 // Establecer el tamaño de celda CSS variable para este grid
                 .style('--cell-size', `${CELL_SIZE}px`);


             // Determinar cuántos días "vacíos" hay al principio para alinear el primer día del mes con el día de la semana correcto
             const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Domingo, 1=Lunes ... 6=Sábado
             // En CSS Grid, queremos que Lunes sea la primera columna (índice 0), Domingo la última (índice 6)
             // getDay() devuelve 0 para Domingo. Si queremos Lunes=0, Martes=1, ..., Domingo=6:
             const jsDayOfWeek = firstDayOfWeek; // 0 (Dom) to 6 (Sab)
             const gridDayOfWeek = (jsDayOfWeek === 0) ? 6 : jsDayOfWeek - 1; // Convertir: Lun=0..Sab=5, Dom=6

             // Añadir celdas vacías para rellenar hasta el primer día de la semana
             for (let i = 0; i < gridDayOfWeek; i++) {
                 dayGrid.append('div').attr('class', 'day-cell empty'); // Celda vacía
             }


             // Añadir las celdas de los días reales del mes
             const dayCells = dayGrid.selectAll('.day-cell.data')
                 .data(allDaysOfMonth) // Bind con todas las fechas del mes
                 .enter()
                 .append('div')
                 .attr('class', 'day-cell data'); // Clase para celdas con potencial data

             // Configurar el color y la clase de resaltado
             dayCells
                 .style('background-color', d => {
                      const circ = monthDataLookup.get(dateFormatter(d)) || 0; // Buscar circulaciones o usar 0
                      return colorScale(circ);
                  })
                 .classed('highlighted', d => specialDatesMap.has(dateFormatter(d))); // Añadir clase si es fecha destacada


             // Añadir interactividad (tooltips)
             dayCells
                 .on('mouseover', function(event, d) {
                     const dateStr = dateFormatter(d);
                     const circulaciones = monthDataLookup.get(dateStr) || 0; // Buscar circulaciones o usar 0
                     const eventInfo = specialDatesMap.get(dateStr);

                     let tooltipHtml = `<strong>${fullDateFormatter(d)}</strong><br>Circulaciones: ${circulaciones}`;
                     if (eventInfo) {
                         tooltipHtml += `<div class="event-info">${eventInfo}</div>`;
                     }

                     tooltip.html(tooltipHtml)
                         .style('display', 'block'); // Mostrar tooltip

                     // Posicionar el tooltip (intento básico para evitar que se salga de pantalla)
                      const tooltipWidth = tooltip.node().offsetWidth;
                      const tooltipHeight = tooltip.node().offsetHeight;
                      const containerRect = container.node().getBoundingClientRect();
                      const cellRect = this.getBoundingClientRect(); // Rectángulo de la celda actual

                      let top = cellRect.top + cellRect.height + 5; // Debajo de la celda + pequeño margen
                      let left = cellRect.left + cellRect.width / 2 - tooltipWidth / 2; // Centrado horizontalmente sobre la celda

                      // Ajustar si se sale por la derecha
                      if (left + tooltipWidth > containerRect.right) {
                          left = containerRect.right - tooltipWidth - 5;
                      }
                       // Ajustar si se sale por la izquierda
                       if (left < containerRect.left) {
                           left = containerRect.left + 5;
                       }
                        // Ajustar si se sale por abajo (ponerlo encima)
                       if (top + tooltipHeight > window.innerHeight + window.scrollY) {
                           top = cellRect.top - tooltipHeight - 5;
                       }
                       // Asegurarse de que no se salga por arriba
                       if (top < 0) {
                           top = 5; // O posicionar debajo si cabe mejor
                       }


                      tooltip
                           .style('left', `${left}px`)
                           .style('top', `${top}px`);

                 })
                 .on('mouseout', function() {
                     tooltip.style('display', 'none'); // Ocultar tooltip
                 });
         }); // Fin del loop de meses
     }); // Fin del loop de años contractuales
}


function renderLegend(container, colorScale, minCirc, maxCirc) {
     // Limpiar contenedor previo
     container.selectAll('*').remove();

    // Crear SVG para el degradado
    const legendWidth = 200;
    const legendHeight = 20;

    const svg = container.append('svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight + 20); // Espacio para las etiquetas

    // Definir el degradado
    const linearGradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    linearGradient.selectAll("stop")
        .data(colorScale.ticks(5).map(t => ({offset: (t - colorScale.domain()[0]) / (colorScale.domain()[1] - colorScale.domain()[0]), color: colorScale(t)})))
        .enter().append("stop")
        .attr("offset", d => `${d.offset * 100}%`)
        .attr("stop-color", d => d.color);
        // Asegurarse de que el color de 0 también está representado o explicado aparte
        // La escala sequential por defecto interpola entre los extremos. Necesitamos puntos intermedios para un gradiente multi-color
        // Usaremos un gradiente CSS simple si la escala D3 es solo bipolor. Si es multi-color (Verde-Amarillo-Rojo) necesitamos más stops o un gradiente CSS.
        // Vamos con un gradiente CSS simple para empezar (Verde a Rojo) como en style.css

     // Renderizar el degradado con CSS en un div
     container.append('span').text(minCirc > 0 ? minCirc : 1); // Etiqueta del mínimo
     container.append('div').attr('class', 'color-scale'); // Barra de color CSS
     container.append('span').text(maxCirc); // Etiqueta del máximo

     // Añadir etiqueta para 0 circulaciones
      container.append('div')
          .style('margin-top', '10px')
          .style('font-size', '0.9em')
          .html(`<span style="display:inline-block; width:16px; height:16px; background-color:${EMPTY_COLOR}; vertical-align:middle; margin-right:5px; border:1px solid #ccc;"></span> 0 circulaciones (o sin datos)`);

}

// Iniciar la aplicación al cargar el script
initializeVisualization();