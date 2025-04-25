// Definición de constantes y dimensiones
const CELL_SIZE = 20;
const GRID_GAP = 2;
const EMPTY_COLOR = '#e0e0e0';
const LEGEND_SCALE_WIDTH = 250;

const weekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const monthMap = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

// Selección de los contenedores principales y el selector
const visualizationContainer = d3.select('#visualization-container');
const chartsContainer = d3.select('#charts-container');
const tooltip = d3.select('#tooltip');
const yearSelector = d3.select('#year-selector');
const specialDatesSection = d3.select('#special-dates-section');
const toggleViewButton = d3.select('#toggle-view-btn');


// Configurar variables CSS en el elemento raíz
d3.select('body').style('--cell-size', `${CELL_SIZE}px`);
d3.select('body').style('--grid-gap', `${GRID_GAP}px`);
d3.select('body').style('--legend-scale-width', `${LEGEND_SCALE_WIDTH}px`);


// Definición de la localización en español para D3
const localeEs = {
  "dateTime": "%A, %e de %B de %Y, %X",
  "date": "%d/%m/%Y",
  "time": "%H:%M:%S",
  "periods": ["AM", "PM"],
  "days": ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  "shortDays": ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  "months": ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  "shortMonths": ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
};

const esLocale = d3.timeFormatDefaultLocale(localeEs);

// Sobrescribir los formateadores de fecha
const fullDateFormatter = esLocale.format('%A, %d de %B de %Y');
const monthNameFormatter = esLocale.format('%B %Y');
const summaryDateFormatter = esLocale.format('%d %B');
const dateFormatter = d3.timeFormat('%Y-%m-%d');
const dateOnlyParser = d3.timeParse('%Y-%m-%d');
const monthYearFormatter = d3.timeFormat('%b %Y');
const weekdayFormatter = esLocale.format('%A');
const monthFormatter = esLocale.format('%B');
const monthStartFormatter = d3.timeFormat('%Y-%m-01');


// Variables para almacenar datos agregados para las gráficas
let monthlyTotalData = [];
let dailyAvgByWeekday = [];
let monthlyAvgByMonth = [];
let monthlySpecialDates = [];


// Función principal asíncrona para cargar y procesar los datos
async function initializeVisualization() {
    try {
        const [rawData, specialDatesData] = await Promise.all([
            d3.json('datos.json'),
            d3.json('fechas_destacadas.json')
        ]);

        console.log("Datos cargados y listos para procesamiento.");

        const dailyData = processRawData(rawData);
        console.log("Datos diarios transformados:", dailyData.length, "entradas.");

        monthlyTotalData = aggregateMonthlyTotals(dailyData);
        dailyAvgByWeekday = aggregateDailyAvgByWeekday(dailyData);
        monthlyAvgByMonth = aggregateMonthlyAvgByMonth(dailyData);
        console.log("Datos agregados para gráficas calculados.");

        const specialDatesMap = processSpecialDates(specialDatesData, dateOnlyParser);
        const sortedSpecialDates = specialDatesData.sort((a, b) => dateOnlyParser(a.fecha) - dateOnlyParser(b.fecha));
        console.log("Mapa de fechas destacadas:", specialDatesMap.size, "entradas.");

        monthlySpecialDates = mapSpecialDatesToMonths(sortedSpecialDates, monthlyTotalData);
        console.log("Fechas destacadas mapeadas a meses:", monthlySpecialDates.length, "puntos con eventos.");


        const allCirculations = dailyData.map(d => d.circulaciones).filter(c => c > 0);
        const minCirc = d3.min(allCirculations) || 1;
        const maxCirc = d3.max(allCirculations) || 1;

        console.log("Min circulaciones (excl. 0):", minCirc);
        console.log("Max circulaciones:", maxCirc);

        const colorScale = d3.scaleLinear()
            .domain([minCirc, (minCirc + maxCirc) / 2, maxCirc])
            .range(['#a5d8b5', '#ffeb84', '#d73027'])
            .clamp(true);

        colorScale.unknown(EMPTY_COLOR);

        const dataByContractualYear = groupDataByContractualYear(dailyData);
        console.log("Datos agrupados por año contractual:", dataByContractualYear.length, "años.");

        const specialDatesByContractualYear = groupSpecialDatesByContractualYear(sortedSpecialDates, dateOnlyParser);
        console.log("Fechas destacadas agrupadas por año contractual:", Object.keys(specialDatesByContractualYear).length, "años.");

        renderCalendar(visualizationContainer, dataByContractualYear, colorScale, specialDatesMap);

        renderLegend(d3.select('#legend'), colorScale, minCirc, maxCirc);

        setupYearSelector(yearSelector, dataByContractualYear, toggleViewButton, visualizationContainer, chartsContainer);

        renderSpecialDatesSection(specialDatesSection, specialDatesByContractualYear, dataByContractualYear, dateOnlyParser, summaryDateFormatter);

        setupViewToggle(toggleViewButton, visualizationContainer, chartsContainer, {
            calendar: () => renderCalendar(visualizationContainer, dataByContractualYear, colorScale, specialDatesMap),
            charts: () => renderCharts(chartsContainer, monthlyTotalData, dailyAvgByWeekday, monthlyAvgByMonth, monthlySpecialDates)
        });

         renderCharts(chartsContainer, monthlyTotalData, dailyAvgByWeekday, monthlyAvgByMonth, monthlySpecialDates);


    } catch (error) {
        console.error("Error al cargar o procesar los datos:", error);
        visualizationContainer.html("<p>Error al cargar los datos. Por favor, verifica los archivos JSON y el servidor local.</p>");
         d3.select('.controls').style('display', 'none');
         specialDatesSection.select('h2').style('display', 'none');
    }
}

// --- Funciones de Procesamiento de Datos ---
function processRawData(data) {
     const flatData = [];
     const dateFormatter = d3.timeFormat('%Y-%m-%d');

     data.forEach(monthEntry => {
         const monthYearStr = monthEntry[""];
         if (!monthYearStr) { console.warn("Mes sin identificador encontrado, saltando:", JSON.stringify(monthEntry)); return; }
         const parts = monthYearStr.split('-');
         if (parts.length !== 2) { console.warn("Formato de mes/año incorrecto:", monthYearStr, ", saltando."); return; }

         const monthAbbr = parts[0];
         const monthIndex = monthMap[monthAbbr];
         if (monthIndex === undefined) { console.warn("Nombre de mes desconocido:", monthAbbr, ", saltando."); return; }

         const yearTwoDigits = parts[1];
         const fullYear = 2000 + parseInt(yearTwoDigits, 10);

         const firstDayOfMonth = new Date(fullYear, monthIndex, 1);
         const lastDayOfMonth = new Date(fullYear, monthIndex + 1, 0);
         const allDaysOfMonth = d3.timeDays(firstDayOfMonth, d3.timeDay.offset(lastDayOfMonth, 1));

         allDaysOfMonth.forEach(date => {
             const day = date.getDate();
             const dayKey = day.toString();
             let circulaciones = 0;

             if (monthEntry.hasOwnProperty(dayKey)) {
                 const circulacionesStr = monthEntry[dayKey];
                  if (circulacionesStr !== "" && !isNaN(parseInt(circulacionesStr, 10))) {
                     circulaciones = parseInt(circulacionesStr, 10);
                  }
             }

             flatData.push({ date: date, circulaciones: circulaciones });
         });
     });

     flatData.sort((a, b) => a.date - b.date);
    return flatData;
}

function processSpecialDates(data, dateOnlyParser) {
    const specialDatesMap = new Map();
    data.forEach(entry => {
        const dateStr = entry.fecha;
        const dateObj = dateOnlyParser(dateStr);
        if (dateObj && entry.evento) {
             specialDatesMap.set(dateStr, entry.evento);
        } else {
             console.warn("Fecha destacada con formato incorrecto o sin evento:", entry);
        }
    });
    return specialDatesMap;
}

function groupDataByContractualYear(dailyData) {
    const years = new Map();

    dailyData.forEach(d => {
        const year = d.date.getFullYear();
        const month = d.date.getMonth();

        let contractualYearKey;
        let startYear, endYear;
        // Año contractual va de Junio (Mes 5) a Mayo (Mes 4) del año siguiente
        if (month >= 5) { startYear = year; endYear = year + 1; }
        else { startYear = year - 1; endYear = year; }
        contractualYearKey = `${startYear}-${endYear}`;

        if (!years.has(contractualYearKey)) { years.set(contractualYearKey, []); }
        years.get(contractualYearKey).push(d);
    });

     const sortedYears = Array.from(years.entries())
         .map(([key, values]) => ({ key, values }))
         .sort((a, b) => parseInt(a.key.split('-')[0], 10) - parseInt(b.key.split('-')[0], 10));

    return sortedYears;
}

function findMaxCirculationDay(dataArray) {
    if (!dataArray || dataArray.length === 0) { return null; }
    const maxCirc = d3.max(dataArray, d => d.circulaciones);
     if (maxCirc === undefined || maxCirc === 0) { // Manejar caso de 0 circulaciones o array vacío/solo 0s
          const firstDay = dataArray[0]?.date || null;
          // Si el array es vacío, devuelve null. Si tiene datos pero todos son 0, devuelve el primer día con 0.
          return (dataArray.length > 0) ? { circulaciones: 0, date: firstDay } : null;
     }
    const maxDay = dataArray.find(d => d.circulaciones === maxCirc);
    return maxDay;
}


function groupSpecialDatesByContractualYear(specialDates, dateOnlyParser) {
    const years = new Map();

    specialDates.forEach(d => {
         const date = dateOnlyParser(d.fecha);
         if (!date) return;

        const year = date.getFullYear();
        const month = date.getMonth();

        let contractualYearKey;
        let startYear, endYear;
        if (month >= 5) { startYear = year; endYear = year + 1; }
        else { startYear = year - 1; endYear = year; }
        contractualYearKey = `${startYear}-${endYear}`;

        if (!years.has(contractualYearKey)) { years.set(contractualYearKey, []); }
        years.get(contractualYearKey).push(d);
    });

     const sortedYears = {};
     Array.from(years.entries())
        .sort((a, b) => parseInt(a[0].split('-')[0], 10) - parseInt(b[0].split('-')[0], 10))
        .forEach(([key, values]) => {
            values.sort((a, b) => dateOnlyParser(a.fecha) - dateOnlyParser(b.fecha));
            sortedYears[key] = values;
        });

    return sortedYears;
}

function mapSpecialDatesToMonths(specialDates, monthlyTotalData) {
    const monthlyEvents = [];
    const monthlyDataLookup = new Map(monthlyTotalData.map(d => [monthStartFormatter(d.date), d]));

    specialDates.forEach(event => {
        const eventDate = dateOnlyParser(event.fecha);
        if (!eventDate) return;

        const eventMonthStart = d3.timeMonth(eventDate);
        const eventMonthStartString = monthStartFormatter(eventMonthStart);

        const correspondingMonthData = monthlyDataLookup.get(eventMonthStartString);

        if (correspondingMonthData) {
             // Agregar el evento al dato mensual correspondiente (opcional, si se necesita)
             if (!correspondingMonthData.events) {
                 correspondingMonthData.events = [];
             }
             correspondingMonthData.events.push(event);

             // Guardar el evento con la información del mes agregado para las gráficas
             monthlyEvents.push({
                  date: correspondingMonthData.date, // Fecha de inicio del mes
                  total: correspondingMonthData.total, // Total del mes
                  eventInfo: event.evento,
                  originalDate: eventDate // Fecha exacta del evento
             });
        } else {
             console.warn(`No se encontró punto de datos mensual agregado para la fecha destacada: ${event.fecha}. Es posible que esta fecha esté fuera del rango de datos mensuales totales calculados.`);
        }
    });

     // Ordenar los eventos por fecha original para mostrarlos cronológicamente
     monthlyEvents.sort((a, b) => a.originalDate - b.originalDate);

    return monthlyEvents;
}


// --- Funciones de Agregación para Gráficas ---

function aggregateMonthlyTotals(dailyData) {
    const monthlyTotals = d3.rollup(dailyData,
        v => d3.sum(v, d => d.circulaciones),
        d => d3.timeMonth(d.date)
    );

    const sortedTotals = Array.from(monthlyTotals, ([date, total]) => ({ date, total }))
        .sort((a, b) => a.date - b.date);

    return sortedTotals;
}

function aggregateDailyAvgByWeekday(dailyData) {
     // D3's getDay() returns 0 for Sunday, 1 for Monday...
     // Map to 0 for Monday, 1 for Tuesday... 6 for Sunday
     const dayOfWeekIndex = d => (d.date.getDay() === 0) ? 6 : d.date.getDay() - 1;

    const weekdayAgg = d3.rollup(dailyData,
        v => ({ total: d3.sum(v, d => d.circulaciones), count: v.length }),
        dayOfWeekIndex
    );

    const sortedAvg = Array.from(weekdayAgg, ([dayIndex, { total, count }]) => ({
        dayIndex: dayIndex,
        average: total / count,
        // Create a dummy date to get the locale-specific weekday name
        weekdayName: esLocale.format('%A')(d3.timeDay.offset(new Date(2023, 0, 2), dayIndex)) // Monday is Jan 2, 2023
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);

    return sortedAvg;
}

function aggregateMonthlyAvgByMonth(dailyData) {
    const monthOfYearAgg = d3.rollup(dailyData,
        v => ({ total: d3.sum(v, d => d.circulaciones), count: v.length }),
        d => d.date.getMonth()
    );

    const sortedAvg = Array.from(monthOfYearAgg, ([monthIndex, { total, count }]) => ({
        monthIndex: monthIndex,
        average: total / count,
        monthName: esLocale.format('%B')(new Date(2000, monthIndex, 1)) // Create a dummy date for the month name
    }))
    .sort((a, b) => a.monthIndex - b.monthIndex);

    return sortedAvg;
}


// --- Funciones de Renderizado (Calendario y Gráficas) ---

function renderCalendar(container, dataByContractualYear, colorScale, specialDatesMap) {
     container.selectAll('*').remove(); // Limpiar contenedor antes de renderizar

    const fullDateFormatter = esLocale.format('%A, %d de %B de %Y');
    const monthNameFormatter = esLocale.format('%B %Y');
     const summaryDateFormatter = esLocale.format('%d %B');
    const dateFormatter = d3.timeFormat('%Y-%m-%d');
    const weekdayFormatter = esLocale.format('%a'); // Formato corto para las etiquetas de día


     dataByContractualYear.forEach((yearData, i) => {
         const yearKey = yearData.key;
         const yearValues = yearData.values;
         const contractualYearNumber = i + 1;

         const yearDiv = container.append('div')
             .attr('class', 'contractual-year')
             .attr('id', `year-${yearKey.replace('-', '_')}`); // ID para el scroll

         yearDiv.append('h2')
             .attr('class', 'year-title')
             .text(`Año Contrato ${contractualYearNumber} (${yearKey})`);

         const yearTotal = d3.sum(yearValues, d => d.circulaciones);
          yearDiv.append('div')
              .attr('class', 'year-total')
              .text(`Total Circulaciones: ${yearTotal}`);

         // const maxYearDay = findMaxCirculationDay(yearValues); // --- ELIMINADO
         // if (maxYearDay && maxYearDay.date) { // Verificar que maxYearDay y su fecha existen --- ELIMINADO
         //      yearDiv.append('div') // --- ELIMINADO
         //          .attr('class', 'year-details') // --- ELIMINADO
         //          .text(`Máx. circulaciones: ${maxYearDay.circulaciones} (${summaryDateFormatter(maxYearDay.date)})`); // --- ELIMINADO
         // } else { // --- ELIMINADO
         //     yearDiv.append('div') // --- ELIMINADO
         //         .attr('class', 'year-details') // --- ELIMINADO
         //         .text('Sin datos de máximos para este año.'); // --- ELIMINADO
         // } // --- ELIMINADO


         const dataByMonth = d3.group(yearValues, d => d.date.getMonth());
         // Meses en orden contractual (Junio a Mayo)
         const monthOrder = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

         // *** NUEVO: Contenedor para la cuadrícula de meses ***
         const monthGridContainer = yearDiv.append('div')
             .attr('class', 'month-grid-container');


         monthOrder.forEach(monthIndex => {
             const monthValues = dataByMonth.has(monthIndex) ? dataByMonth.get(monthIndex) : [];

             let yearOfThisMonth;
             const [startYearContractual, endYearContractual] = yearKey.split('-').map(Number);

              // Determinar el año correcto para crear el objeto Date del primer día del mes
              if (monthIndex >= 5) { yearOfThisMonth = startYearContractual; } // Meses de Junio a Diciembre usan el año de inicio del contrato
             else { yearOfThisMonth = endYearContractual; } // Meses de Enero a Mayo usan el año de fin del contrato


             const firstDayOfMonth = new Date(yearOfThisMonth, monthIndex, 1);
             // Asegurarse de que la fecha es válida antes de usarla
             if (isNaN(firstDayOfMonth.getTime())) {
                 console.error("Fecha no válida generada para el mes:", monthIndex, "Año:", yearOfThisMonth);
                 return; // Saltar este mes si la fecha no es válida
             }

             const lastDayOfMonth = new Date(yearOfThisMonth, monthIndex + 1, 0);
             const allDaysOfMonth = d3.timeDays(firstDayOfMonth, d3.timeDay.offset(lastDayOfMonth, 1));

             const monthDataLookup = new Map(monthValues.map(d => [dateFormatter(d.date), d.circulaciones]));
             const monthTotal = d3.sum(monthValues, d => d.circulaciones);

             const monthDiv = monthGridContainer.append('div') // Añadir el mes al nuevo contenedor de cuadrícula
                 .attr('class', 'month');

             monthDiv.append('div')
                 .attr('class', 'month-title')
                 .text(monthNameFormatter(firstDayOfMonth));

              monthDiv.append('div')
                   .attr('class', 'month-total')
                   .text(`Total: ${monthTotal}`);

             // const maxMonthDay = findMaxCirculationDay(monthValues); // --- ELIMINADO
              // if (maxMonthDay && maxMonthDay.date) { // Verificar que maxMonthDay y su fecha existen --- ELIMINADO
              //     monthDiv.append('div') // --- ELIMINADO
              //         .attr('class', 'month-details') // --- ELIMINADO
              //         .text(`Máx: ${maxMonthDay.circulaciones} (${maxMonthDay.date.getDate()})`); // --- ELIMINADO
             // } else { // --- ELIMINADO
             //     monthDiv.append('div') // --- ELIMINADO
             //         .attr('class', 'month-details') // --- ELIMINADO
             //         .text('Máx: 0'); // Mostrar 0 si no hay datos o solo 0s --- ELIMINADO
             // } // --- ELIMINADO


             const weekdayLabelsDiv = monthDiv.append('div')
                 .attr('class', 'weekday-labels');

              weekdayLabelsDiv.selectAll('.weekday-label')
                 .data(weekdayLabels) // Usar las etiquetas cortas definidas
                 .enter()
                 .append('div')
                 .attr('class', 'weekday-label')
                 .text(d => d);

             const dayGrid = monthDiv.append('div')
                 .attr('class', 'day-grid');

             const firstDayOfWeek = firstDayOfMonth.getDay();
              // Ajustar el índice para que Lunes sea 0 y Domingo sea 6
             const gridDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;

             // Añadir celdas vacías al principio para alinear el primer día correctamente
             for (let i = 0; i < gridDayOfWeek; i++) {
                 dayGrid.append('div').attr('class', 'day-cell empty');
             }

             const dayCells = dayGrid.selectAll('.day-cell.data')
                 .data(allDaysOfMonth)
                 .enter()
                 .append('div')
                 .attr('class', 'day-cell data');

             dayCells.append('span')
                 .text(d => d.getDate());

             dayCells
                 .style('background-color', d => {
                      const circ = monthDataLookup.get(dateFormatter(d)) || 0; // Usa 0 si no hay datos
                      return colorScale(circ);
                  })
                 .classed('highlighted', d => specialDatesMap.has(dateFormatter(d)));


             dayCells
                 .on('mouseover', function(event, d) {
                     const dateStr = dateFormatter(d);
                     const circulaciones = monthDataLookup.get(dateStr) || 0;
                     const eventInfo = specialDatesMap.get(dateStr);

                     let tooltipHtml = `<strong>${fullDateFormatter(d)}</strong><br>Circulaciones: ${circulaciones}`;
                     if (eventInfo) {
                         tooltipHtml += `<div class="event-info">${eventInfo}</div>`;
                     }

                     tooltip.html(tooltipHtml)
                         .style('display', 'block');

                     // Posicionar el tooltip
                     const tooltipNode = tooltip.node();
                     const tooltipWidth = tooltipNode.offsetWidth;
                     const tooltipHeight = tooltipNode.offsetHeight;
                     const cellRect = this.getBoundingClientRect(); // Posición relativa a la ventana

                     let top = cellRect.bottom + window.scrollY + 8;
                     let left = cellRect.left + window.scrollX + cellRect.width / 2 - tooltipWidth / 2;

                     // Ajustar posición si sale por los bordes
                     if (left + tooltipWidth > window.innerWidth + window.scrollX - 10) { left = window.innerWidth + window.scrollX - tooltipWidth - 10; }
                     if (left < window.scrollX + 10) { left = window.scrollX + 10; }
                      // Si el tooltip sale por abajo, posicionarlo encima de la celda
                     if (top + tooltipHeight > window.innerHeight + window.scrollY - 10) { top = cellRect.top + window.scrollY - tooltipHeight - 8; }
                      // Si incluso arriba sale por arriba (ventana pequeña), posicionarlo arriba a la izquierda
                     if (top < window.scrollY + 10) {
                          top = window.scrollY + 10;
                          left = window.scrollX + 10;
                     }


                    tooltip
                        .style('left', `${left}px`)
                        .style('top', `${top}px`);

                })
                .on('mouseout', function() {
                    tooltip.style('display', 'none');
                });
         });
     });
}


function renderCharts(container, monthlyTotalData, dailyAvgByWeekday, monthlyAvgByMonth, monthlySpecialDates) {
    container.select('#chart-trend').selectAll('*').remove();
    container.select('#chart-weekday').selectAll('*').remove();
    container.select('#chart-month').selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const containerNode = container.node();
    // Asegurar que containerNode no es null antes de obtener su ancho
    const containerWidth = containerNode ? parseInt(containerNode.getBoundingClientRect().width) : 960;
    const width = containerWidth - margin.left - margin.right;
    let height = 300; // Altura base para las gráficas


    // Renderizar solo si hay datos
    if (monthlyTotalData && monthlyTotalData.length > 0) {
        renderMonthlyTrendChart(container.select('#chart-trend'), monthlyTotalData, monthlySpecialDates, margin, width, height);
    } else {
         container.select('#chart-trend').html('<p class="no-data">No hay datos suficientes para mostrar la gráfica de tendencia mensual.</p>');
    }

    if (dailyAvgByWeekday && dailyAvgByWeekday.length > 0) {
        renderWeekdayAvgChart(container.select('#chart-weekday'), dailyAvgByWeekday, margin, width, height);
    } else {
         container.select('#chart-weekday').html('<p class="no-data">No hay datos suficientes para mostrar la gráfica de promedio por día de la semana.</p>');
    }

    if (monthlyAvgByMonth && monthlyAvgByMonth.length > 0) {
       renderMonthAvgChart(container.select('#chart-month'), monthlyAvgByMonth, margin, width, height);
    } else {
        container.select('#chart-month').html('<p class="no-data">No hay datos suficientes para mostrar la gráfica de promedio por mes del año.</p>');
    }
}

function renderMonthlyTrendChart(container, data, monthlySpecialDates, margin, width, height) {
    container.append('h3').text('Total de Circulaciones por Mes');

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total)]).nice()
        .range([height, 0]);

    const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %Y'));
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
         .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

    svg.append("g")
        .call(yAxis);

     svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Total Circulaciones Mensuales");

      svg.append("text")
         .attr("x", width / 2)
         .attr("y", height + margin.bottom - 5)
         .style("text-anchor", "middle")
         .text("Fecha");

    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.total));

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);

     svg.selectAll(".data-point")
         .data(data)
         .enter().append("circle")
         .attr("class", "data-point")
         .attr("cx", d => xScale(d.date))
         .attr("cy", d => yScale(d.total))
         .attr("r", 3)
         .attr("fill", "steelblue");

     svg.selectAll(".event-marker")
         .data(monthlySpecialDates)
         .enter().append("circle")
         .attr("class", "event-marker")
         .attr("cx", d => xScale(d.date)) // Usar la fecha de inicio del mes para posicionar el marcador
         .attr("cy", d => yScale(d.total)) // Usar el total del mes para la posición Y
         .attr("r", 6)
         .attr("fill", "#e74c3c")
         .attr("stroke", "#fff")
         .attr("stroke-width", 1.5)
         .style("cursor", "pointer")
         .on('mouseover', function(event, d) {
              const formattedOriginalDate = fullDateFormatter(d.originalDate); // Mostrar la fecha exacta del evento
              let tooltipHtml = `<strong>${formattedOriginalDate}</strong><br>Total Circulaciones Mes (${monthYearFormatter(d.date)}): ${d.total}`;
              if(d.eventInfo) { // Asegurarse de que eventInfo existe
                 tooltipHtml += `<div class="event-info">${d.eventInfo}</div>`;
              }


              tooltip.html(tooltipHtml)
                  .style('display', 'block');

              // Posicionar el tooltip
              const tooltipNode = tooltip.node();
              const tooltipWidth = tooltipNode.offsetWidth;
              const tooltipHeight = tooltipNode.offsetHeight;
              // Ajustar para que el tooltip no se salga de la pantalla
               let top = event.clientY + window.scrollY + 10;
               let left = event.clientX + window.scrollX + 10;

               if (left + tooltipWidth > window.innerWidth + window.scrollX - 10) { left = event.clientX + window.scrollX - tooltipWidth - 10; }
               if (left < window.scrollX + 10) { left = window.scrollX + 10; }
               if (top + tooltipHeight > window.innerHeight + window.scrollY - 10) { top = event.clientY + window.scrollY - tooltipHeight - 10; }
                if (top < window.scrollY + 10) { top = window.scrollY + 10; }


              tooltip
                  .style('left', `${left}px`)
                  .style('top', `${top}px`);

         })
         .on('mouseout', function() {
             tooltip.style('display', 'none');
         });


}

function renderWeekdayAvgChart(container, data, margin, width, height) {
    container.append('h3').text('Promedio de Circulaciones por Día de la Semana');

     const adjustedHeight = height;
      const adjustedMarginBottom = margin.bottom + 20; // Espacio extra para las etiquetas del eje X si rotan


    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", adjustedHeight + margin.top + adjustedMarginBottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
        .domain(data.map(d => d.weekdayName))
        .range([0, width])
        .padding(0.1);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.average)]).nice()
        .range([adjustedHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", `translate(0,${adjustedHeight})`)
        .call(xAxis);

    svg.append("g")
        .call(yAxis);

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (adjustedHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Promedio Diario de Circulaciones");

      svg.append("text")
         .attr("x", width / 2)
         .attr("y", adjustedHeight + adjustedMarginBottom - 5)
         .style("text-anchor", "middle")
         .text("Día de la Semana");


    svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.weekdayName))
        .attr("y", d => yScale(d.average))
        .attr("width", xScale.bandwidth())
        .attr("height", d => adjustedHeight - yScale(d.average))
        .attr("fill", "steelblue");

     // Etiquetas sobre las barras
     svg.selectAll(".bar-label")
         .data(data)
         .enter().append("text")
         .attr("class", "bar-label")
         .attr("x", d => xScale(d.weekdayName) + xScale.bandwidth() / 2)
         .attr("y", d => yScale(d.average) - 5) // Ligeramente por encima de la barra
         .attr("text-anchor", "middle")
         .style("font-size", "0.8em")
         .style("fill", "#555") // Color oscuro para contraste
         .text(d => Math.round(d.average)); // Redondear el promedio
}

function renderMonthAvgChart(container, data, margin, width, height) {
    container.append('h3').text('Promedio de Circulaciones por Mes del Año');

     const adjustedHeight = height;
      const adjustedMarginBottom = margin.bottom + 20; // Espacio extra para las etiquetas del eje X


    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", adjustedHeight + margin.top + adjustedMarginBottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
        .domain(data.map(d => d.monthName))
        .range([0, width])
        .padding(0.1);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.average)]).nice()
        .range([adjustedHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", `translate(0,${adjustedHeight})`)
        .call(xAxis)
        .selectAll("text")
            .attr("transform", "rotate(-45)") // Rotar etiquetas para que no se superpongan
            .style("text-anchor", "end");


    svg.append("g")
        .call(yAxis);

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (adjustedHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Promedio Diario de Circulaciones");

      svg.append("text")
         .attr("x", width / 2)
         .attr("y", adjustedHeight + adjustedMarginBottom - 5)
         .style("text-anchor", "middle")
         .text("Mes del Año");


    svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.monthName))
        .attr("y", d => yScale(d.average))
        .attr("width", xScale.bandwidth())
        .attr("height", d => adjustedHeight - yScale(d.average))
        .attr("fill", "steelblue");

     // Etiquetas sobre las barras
     svg.selectAll(".bar-label")
         .data(data)
         .enter().append("text")
         .attr("class", "bar-label")
         .attr("x", d => xScale(d.monthName) + xScale.bandwidth() / 2)
         .attr("y", d => yScale(d.average) - 5) // Ligeramente por encima de la barra
         .attr("text-anchor", "middle")
         .style("font-size", "0.8em")
         .style("fill", "#555") // Color oscuro para contraste
         .text(d => Math.round(d.average)); // Redondear el promedio
}


function renderLegend(container, colorScale, minCirc, maxCirc) {
     container.selectAll('*').remove(); // Limpiar contenedor antes de renderizar

    const legendWidth = LEGEND_SCALE_WIDTH;
    const legendHeight = 25;
    const numTicks = 5; // Número sugerido de ticks

    const scaleContainer = container.append('div')
        .attr('class', 'legend-scale-container');

    scaleContainer.append('span').text(minCirc > 0 ? minCirc : 1); // Mostrar el mínimo real o 1

    const svg = scaleContainer.append('svg')
        .attr("width", legendWidth)
        .attr("height", legendHeight);

    const linearGradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "gradient-scale")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

     // Asegurarse de que el dominio y el rango tienen el mismo número de puntos o colores
     const domainValues = colorScale.domain();
     const rangeColors = colorScale.range();

     domainValues.forEach((value, i) => {
         // Calcular el offset proporcionalmente dentro del dominio
         const offset = (value - domainValues[0]) / (domainValues[domainValues.length - 1] - domainValues[0]);
         linearGradient.append("stop")
             .attr("offset", `${offset * 100}%`)
             .attr("stop-color", rangeColors[i]);
     });


    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#gradient-scale)");


    scaleContainer.append('span').text(maxCirc);

     const labelContainer = container.append('div')
         .attr('class', 'legend-labels');

    // Generar ticks para la escala lineal
    const legendTicks = colorScale.ticks(numTicks);

     // Asegurar que min y max están incluidos si no lo están ya
     if (legendTicks.length === 0 || legendTicks[0] > minCirc) {
         legendTicks.unshift(minCirc);
     }
     if (legendTicks.length === 0 || legendTicks[legendTicks.length - 1] < maxCirc) {
         legendTicks.push(maxCirc);
     }
     // Eliminar duplicados y ordenar
     const uniqueTicks = Array.from(new Set(legendTicks)).sort((a, b) => a - b);


    labelContainer.selectAll('span')
        .data(uniqueTicks)
        .enter()
        .append('span')
        .style('font-size', '0.8em');


     // Usar Flexbox o Grid para distribuir las etiquetas
      labelContainer.style('display', 'flex')
                    .style('justify-content', 'space-between') // Distribuir espacio
                    .style('width', `${legendWidth}px`); // Asegurar que ocupa el mismo ancho que la escala


    container.append('div')
        .attr('class', 'legend-zero-info')
        .html(`<span style="background-color:${EMPTY_COLOR}; border-color: #ccc;"></span> 0 circulaciones (o sin datos)`);

}


// *** MODIFICACIÓN: setupYearSelector para cambiar de vista si es necesario antes del scroll ***
function setupYearSelector(selector, dataByContractualYear, toggleButton, calendarContainer, chartsContainer) {
    selector.selectAll('option:not(:first-child)').remove(); // Limpiar opciones existentes

    selector.selectAll('option.year-option')
        .data(dataByContractualYear)
        .enter()
        .append('option')
        .attr('class', 'year-option')
        .attr('value', d => d.key.replace('-', '_'))
        .text((d, i) => `Año Contrato ${i + 1} (${d.key})`);

    selector.on('change', function() {
        const selectedYearId = this.value;
        // Resetear el selector inmediatamente para que el usuario pueda volver a usarlo
        selector.property('selectedIndex', 0);

        if (selectedYearId) {
            // Comprobar si la vista de calendario está visible
            const isCalendarViewVisible = !calendarContainer.classed('hidden');

             if (isCalendarViewVisible) {
                 // Si ya estamos en la vista de calendario, simplemente hacer scroll
                  const targetElement = document.getElementById(`year-${selectedYearId}`);
                  if (targetElement) {
                      targetElement.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start' // Desplazarse para que el elemento quede al inicio de la ventana
                      });
                  } else {
                      console.warn(`Elemento con ID year-${selectedYearId} no encontrado para hacer scroll.`);
                  }
             } else { // Si NO es vista de calendario (es vista de gráficas)
                 // Cambiar a la vista de calendario programáticamente
                  // console.log("Cambiando a vista de calendario y haciendo scroll...");
                  // Disparar un clic en el botón de toggle para cambiar la vista
                  // Clonar el evento para asegurar compatibilidad
                  const clickEvent = new MouseEvent('click', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                  });
                  toggleButton.node().dispatchEvent(clickEvent);

                  // Esperar un poco para que la transición de ocultar/mostrar termine y el DOM se actualice
                  setTimeout(() => {
                       const targetElement = document.getElementById(`year-${selectedYearId}`);
                       if (targetElement) {
                           targetElement.scrollIntoView({
                               behavior: 'smooth',
                               block: 'start'
                           });
                       } else {
                           console.warn(`Elemento con ID year-${selectedYearId} no encontrado para hacer scroll después de cambiar vista.`);
                       }
                  }, 350); // 350ms es un tiempo estimado, puede variar

             }
        }
    });
}


function renderSpecialDatesSection(container, specialDatesByContractualYear, dataByContractualYear, dateOnlyParser, summaryDateFormatter) {
     container.selectAll('.special-dates-year').remove(); // Limpiar sección

     const yearKeys = Object.keys(specialDatesByContractualYear);

     // Crear un mapa para asociar la clave del año contractual con su número de orden
     const yearKeyToNumber = new Map(dataByContractualYear.map((d, i) => [d.key, i + 1]));

     // Ordenar las claves de los años contractuales
     yearKeys.sort((a, b) => parseInt(a.split('-')[0], 10) - parseInt(b.split('-')[0], 10));


     yearKeys.forEach(yearKey => {
         const datesInYear = specialDatesByContractualYear[yearKey];

         if (datesInYear.length > 0) {
             const yearDiv = container.append('div')
                 .attr('class', 'special-dates-year');

             const contractualYearNumber = yearKeyToNumber.get(yearKey) || 'N/A';
             yearDiv.append('h3').text(`Año Contrato (${contractualYearNumber}) ${yearKey}`);

             const list = yearDiv.append('ul').attr('class', 'special-dates-list');

             list.selectAll('.special-date-item')
                 .data(datesInYear)
                 .enter()
                 .append('li')
                 .attr('class', 'special-date-item')
                 .html(d => {
                      const date = dateOnlyParser(d.fecha);
                       // Verificar si la fecha es válida antes de formatear
                      const formattedDate = date ? summaryDateFormatter(date) : d.fecha;

                      return `<strong>${formattedDate}:</strong> <span>${d.evento}</span>`;
                 });
         }
     });

     // Mostrar u ocultar el título principal de la sección si no hay eventos
     if (yearKeys.length === 0 || yearKeys.every(key => specialDatesByContractualYear[key].length === 0)) {
          container.append('p').text('No hay fechas destacadas definidas en este momento.');
          container.select('h2').style('display', 'none');
     } else {
          container.select('h2').style('display', 'block'); // Asegurarse de que está visible si hay eventos
     }
}


// Lógica para alternar entre vistas
function setupViewToggle(button, calendarContainer, chartsContainer, renderFunctions) {
    let isCalendarView = true; // Estado: true = Calendar visible, false = Charts visible

    button.on('click', () => {
        isCalendarView = !isCalendarView; // Cambiar estado

        if (isCalendarView) {
            // Mostrar calendario, ocultar gráficas
            chartsContainer.classed('hidden', true);
            calendarContainer.classed('hidden', false);
            button.text('Mostrar Gráficas');
            yearSelector.style('visibility', 'visible'); // Mostrar selector de año
            // d3.select('.controls').style('justify-content', 'center'); // Restaurar justificación si se cambió

             specialDatesSection.classed('hidden', false); // Mostrar sección de eventos también con calendario

        } else {
            // Mostrar gráficas, ocultar calendario
            calendarContainer.classed('hidden', true);
            chartsContainer.classed('hidden', false);
            button.text('Mostrar Calendario');
             yearSelector.style('visibility', 'hidden'); // Ocultar selector de año pero mantener el espacio

             // Opcional: ajustar justificación si el selector está oculto
             // d3.select('.controls').style('justify-content', 'center'); // Si solo queda el botón

             specialDatesSection.classed('hidden', false); // Mostrar sección de eventos también con gráficas

            // Renderizar gráficas (por si acaso el tamaño del contenedor ha cambiado)
             renderFunctions.charts();
        }
         tooltip.style('display', 'none'); // Ocultar tooltip al cambiar de vista
    });
    // Asegurarse de que la vista inicial es la de calendario
    chartsContainer.classed('hidden', true);
    calendarContainer.classed('hidden', false);
    button.text('Mostrar Gráficas');
    yearSelector.style('visibility', 'visible');
    specialDatesSection.classed('hidden', false);
}


// Iniciar la aplicación al cargar el script
initializeVisualization();
