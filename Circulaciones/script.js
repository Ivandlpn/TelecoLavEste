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
const yearSelectorContainer = d3.select('.year-selector-container'); // Seleccionar el nuevo contenedor
const specialDatesSection = d3.select('#special-dates-section');
const toggleViewButton = d3.select('#toggle-view-btn');
const toggleSingleViewButton = d3.select('#toggle-single-view-btn'); // Nuevo botón
const singleViewContainer = d3.select('#single-view-container'); // Nuevo contenedor
const toggleTimeAxisButton = d3.select('#toggle-time-axis-btn'); // Nuevo botón EJE TIEMPO
const timeAxisContainer = d3.select('#time-axis-container'); // Nuevo contenedor EJE TIEMPO
const toggleCounterButton = d3.select('#toggle-counter-btn');
const counterContainer = d3.select('#counter-container');
const toggleChatbotButton = d3.select('#toggle-chatbot-btn');
const chatbotContainer = d3.select('#chatbot-container');
// Selección del contenedor de filtros rápidos
const quickFiltersContainer = d3.select('#quick-filters-container');

// Selección de los selectores de fecha y el botón de filtro
const startDateInput = d3.select('#start-date');
const endDateInput = d3.select('#end-date');
const applyDateFilterButton = d3.select('#apply-date-filter-btn');
const dateFilterContainer = d3.select('.date-filter-container'); // Nuevo contenedor para el filtro de fecha


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
        window.dailyData = dailyData; // Hacer los datos disponibles globalmente
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
            .range(['#4CAF50', '#ffeb84', '#c0392b']) // Rango de color más pronunciado (verde a rojo oscuro)
            .clamp(true);

        colorScale.unknown(EMPTY_COLOR);

        const dataByContractualYear = groupDataByContractualYear(dailyData);
        console.log("Datos agrupados por año contractual:", dataByContractualYear.length, "años.");

        const specialDatesByContractualYear = groupSpecialDatesByContractualYear(sortedSpecialDates, dateOnlyParser);
        console.log("Fechas destacadas agrupadas por año contractual:", Object.keys(specialDatesByContractualYear).length, "años.");

        renderCalendar(visualizationContainer, dataByContractualYear, colorScale, specialDatesMap);

        renderLegend(d3.select('#legend'), colorScale, minCirc, maxCirc);

        setupYearSelector(yearSelector, dataByContractualYear, toggleViewButton, visualizationContainer, chartsContainer, dailyData, monthlySpecialDates); // Pasar dailyData y monthlySpecialDates

        renderSpecialDatesSection(specialDatesSection, specialDatesByContractualYear, dataByContractualYear, dateOnlyParser, summaryDateFormatter);

        // Configurar la navegación por pestañas
        setupTabNavigation({
            calendar: visualizationContainer,
            charts: chartsContainer,
            single: singleViewContainer,
            time: timeAxisContainer,
            counter: counterContainer,
            files: d3.select('#files-container'),
            chatbot: chatbotContainer
        }, {
            calendar: () => {
                quickFiltersContainer.classed('hidden', true);
                specialDatesSection.classed('hidden', false);
                renderCalendar(visualizationContainer, dataByContractualYear, colorScale, specialDatesMap);
            },
            charts: () => {
                quickFiltersContainer.classed('hidden', false);
                specialDatesSection.classed('hidden', true);
                renderCharts(chartsContainer, dailyData, monthlyTotalData, dailyAvgByWeekday, monthlyAvgByMonth, monthlySpecialDates, colorScale, specialDatesMap);
                
                // Aplicar el filtro de fecha actual
                const startDate = startDateInput.node().value;
                const endDate = endDateInput.node().value;
                if (startDate && endDate) {
                    applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate);
                }
            },
            single: () => {
                quickFiltersContainer.classed('hidden', true);
                specialDatesSection.classed('hidden', true);
                renderSingleViewTable(singleViewContainer, dailyData, dataByContractualYear, colorScale, specialDatesMap);
            },
            time: () => {
                quickFiltersContainer.classed('hidden', true);
                specialDatesSection.classed('hidden', true);
                updateCurrentDateDisplay();
                updateTimelineLinePosition();
            },
            counter: () => {
                quickFiltersContainer.classed('hidden', true);
                specialDatesSection.classed('hidden', true);
                renderCounterView(counterContainer);
            },
            chatbot: () => {
                quickFiltersContainer.classed('hidden', true);
                specialDatesSection.classed('hidden', true);
                renderChatbotView(chatbotContainer);
            }
        }, dailyData, monthlySpecialDates, colorScale);

   // Configurar el rango de fechas completo por defecto
   const defaultStartDate = new Date(2013, 5, 18); // Fecha de inicio fija
   // Encontrar la última fecha con circulación no nula
   let lastNonZeroCirculationDate = new Date(2013, 5, 18); // Empezar desde la fecha de inicio
   for (let i = 0; i < dailyData.length; i++) {
       if (dailyData[i].circulaciones !== null && dailyData[i].circulaciones > 0) {
           lastNonZeroCirculationDate = dailyData[i].date;
       }
   }
   const defaultEndDate = lastNonZeroCirculationDate;

   // Formatear fechas para los inputs
   const formatDateForInput = (date) => {
       const d = new Date(date);
       const year = d.getFullYear();
       const month = String(d.getMonth() + 1).padStart(2, '0');
       const day = String(d.getDate()).padStart(2, '0');
       return `${year}-${month}-${day}`;
   };

   // Establecer los valores iniciales de los inputs de fecha
   const startDateStr = formatDateForInput(defaultStartDate);
   const endDateStr = formatDateForInput(defaultEndDate);
   
   startDateInput.property('value', startDateStr);
   endDateInput.property('value', endDateStr);

   // Configurar el filtro de fechas con los valores por defecto
   setupDateFilter(dailyData, chartsContainer, colorScale, monthlySpecialDates);
   
   // Configurar los filtros rápidos
   setupQuickFilters(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDateInput, endDateInput, applyDateFilterAndRender);
   
   // Configurar el manejador para el botón de aplicar filtro
   const applyFilter = () => {
       // Asegurarse de que tenemos las fechas correctas
       const startDate = new Date(startDateInput.node().value);
       const endDate = new Date(endDateInput.node().value);
       
       // Asegurarse de que las fechas son válidas
       if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
           console.error('Fechas inválidas:', startDate, endDate);
           return;
       }
       
       // Aplicar el filtro
       applyDateFilterAndRender(
           dailyData, 
           chartsContainer, 
           colorScale, 
           monthlySpecialDates, 
           startDate, 
           endDate
       );
   };
   
   // Configurar el evento click del botón de aplicar filtro
   d3.select('#apply-date-filter-btn').on('click', applyFilter);
   
   // Activar la pestaña de vista única por defecto
   d3.select('.nav-btn[data-view="single"]').classed('active', true);
   
   // Función para hacer clic en el botón
   const clickApplyButton = () => {
       console.log('Buscando botón de aplicar filtro...');
       const button = document.querySelector('button#apply-date-filter-btn');
       if (button) {
           console.log('Botón encontrado, haciendo clic...');
           button.click();
           console.log('Clic realizado');
       } else {
           console.error('Botón no encontrado, reintentando...');
           setTimeout(clickApplyButton, 500);
       }
   };

   // Iniciar el proceso de clic con múltiples intentos
   console.log('Iniciando proceso de clic automático...');
   clickApplyButton();
                
                // Inicializar el procesador del chatbot con los datos cargados
                console.log('Inicializando chatbot con datos:', dailyData ? dailyData.length : 'null', 'registros');
                console.log('Inicializando chatbot con fechas especiales:', sortedSpecialDates ? sortedSpecialDates.length : 'null', 'fechas');
                
                // Asegurarnos de que los datos están disponibles antes de inicializar
                if (dailyData && dailyData.length > 0) {
                    chatbotProcessor.initialize(dailyData, sortedSpecialDates);
                    console.log('Chatbot inicializado correctamente');
                } else {
                    console.error('Error: No hay datos disponibles para inicializar el chatbot');
                }
        
                // Add resize event listener to redraw charts when visible
                window.addEventListener('resize', () => {
                    // Check if the charts container is currently visible
                    if (!chartsContainer.classed('hidden')) {
                        // Re-render charts with current data and scale
                        // Need to pass the current filtered data and date range
                        const startDateStr = startDateInput.property('value');
                        const endDateStr = endDateInput.property('value');
                        const startDate = dateOnlyParser(startDateStr);
                        const endDate = dateOnlyParser(endDateStr);
        
                        if (startDate && endDate) {
                            applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate);
                        } else {
                            // If dates are not set, use defaults (shouldn't happen if initialized correctly)
                            const defaultStartDate = new Date(2013, 5, 18);
                            let lastNonZeroCirculationDate = new Date();
                            for (let i = dailyData.length - 1; i >= 0; i--) {
                                if (dailyData[i].circulaciones !== null && dailyData[i].circulaciones > 0) {
                                    lastNonZeroCirculationDate = dailyData[i].date;
                                    break;
                                }
                            }
                            const defaultEndDate = lastNonZeroCirculationDate;
                            applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, defaultStartDate, defaultEndDate);
                        }
                    }
                });
        
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

             if (monthEntry.hasOwnProperty(dayKey) && monthEntry[dayKey] !== "") {
                 const circulacionesStr = monthEntry[dayKey];
                 if (!isNaN(parseInt(circulacionesStr, 10))) {
                     circulaciones = parseInt(circulacionesStr, 10);
                 }
             } else {
                 circulaciones = null; // Usar null para días sin datos
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

// Función para posicionar el marcador de la fecha actual en el eje de tiempo


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
                      if (circ === 0) {
                          return '#ffffff'; // Blanco para 0 circulaciones o sin datos
                      }
                      return colorScale(circ); // Usar la escala de color para > 0 circulaciones
                  })
                  .classed('highlighted', d => specialDatesMap.has(dateFormatter(d)));

              // Añadir icono a las celdas destacadas
              dayCells.filter('.highlighted')
                  .append('div')
                  .attr('class', 'highlight-icon')
                  .html('⭐'); // Icono de estrella para destacar


             dayCells
                 .on('mouseover', function(event, d) {
                     const dateStr = dateFormatter(d);
                     const circulaciones = monthDataLookup.get(dateStr) || 0;
                     const eventInfo = specialDatesMap.get(dateStr);

                     let tooltipHtml = `<strong>${fullDateFormatter(d)}</strong><br>Circulaciones: ${circulaciones}`;
                     if (eventInfo) {
                         tooltipHtml = `⚠️ ${tooltipHtml}<div class="event-info">${eventInfo}</div>`; // Añadir icono de advertencia amarillo y mantener info del evento
                     }

                     tooltip.html(tooltipHtml)
                         .style('display', 'block');

                     // Posicionar el tooltip encima de la celda
                     const tooltipNode = tooltip.node();
                     const cellRect = this.getBoundingClientRect(); // Obtener dimensiones de la celda
                     const tooltipWidth = tooltipNode.offsetWidth;
                     const tooltipHeight = tooltipNode.offsetHeight;
                     const containerRect = container.node().getBoundingClientRect();

                     // Calcular posición para centrar horizontalmente sobre la celda y encima de ella
                     // Usar coordenadas relativas a la página, teniendo en cuenta el scroll
                     const scrollX = window.scrollX || window.pageXOffset;
                     const scrollY = window.scrollY || window.pageYOffset;

                     let tooltipLeft = cellRect.left + scrollX + (cellRect.width / 2) - (tooltipWidth / 2);
                     let tooltipTop = cellRect.top + scrollY - tooltipHeight - 5; // 5px de padding

                     // Ajustar si se sale por la izquierda
                     if (tooltipLeft < scrollX) {
                         tooltipLeft = scrollX + 5;
                     }

                     // Ajustar si se sale por la derecha
                     if (tooltipLeft + tooltipWidth > window.innerWidth + scrollX) {
                         tooltipLeft = window.innerWidth + scrollX - tooltipWidth - 5;
                     }

                     // Ajustar si se sale por arriba (mostrar debajo en su lugar)
                     if (tooltipTop < scrollY) {
                         tooltipTop = cellRect.bottom + scrollY + 5;
                     }


                     tooltip
                         .style('left', `${tooltipLeft}px`)
                         .style('top', `${tooltipTop}px`);
                 })
                 .on('mouseout', function() {
                     tooltip.style('display', 'none');
                 });
         });
     });
}


function renderCharts(container, dailyData, monthlyTotalData, dailyAvgByWeekday, monthlyAvgByMonth, monthlySpecialDates, colorScale, specialDatesMap, startDate = null, endDate = null) {
    // Limpiar contenedores de gráficos
    container.select('#chart-trend').selectAll('*').remove();
    container.select('#chart-weekday').selectAll('*').remove();
    container.select('#chart-month').selectAll('*').remove();

    // Configurar márgenes y dimensiones
    const margin = { top: 100, right: 30, bottom: 60, left: 60 };
    const containerNode = container.node();
    const containerWidth = containerNode ? parseInt(containerNode.getBoundingClientRect().width) : 960;
    // Calculate width based on container, ensuring it's not negative
    const width = Math.max(0, containerWidth - margin.left - margin.right);
    const height = 300; // Altura fija para la gráfica

    // Establecer fecha de inicio fija: 18 de junio de 2013
    if (!startDate) {
        startDate = new Date(2013, 5, 18); // 18 de junio de 2013 (los meses en JavaScript van de 0 a 11)
        // Asegurarse de que la hora sea 00:00:00 para incluir todo el día
        startDate.setHours(0, 0, 0, 0);
    }
    
    // Establecer fecha de fin como la más reciente de los datos si no se especifica
    if (!endDate) {
        const dates = dailyData.map(d => d.date);
        endDate = d3.max(dates);
    }

    // Asegurarse de que las fechas sean objetos Date
    startDate = new Date(startDate);
    endDate = new Date(endDate);

    // Ajustar la fecha de fin para incluir todo el día
    const adjustedEndDate = d3.timeDay.offset(endDate, 1);
    
    // Filtrar los datos por el rango de fechas
    const filteredDailyData = dailyData.filter(d => d.date >= startDate && d.date < adjustedEndDate);

    // Usar los datos filtrados para la gráfica de tendencia
    let dataToRender = [];
    let specialDatesToRender = [];

    if (filteredDailyData.length > 0) {
        dataToRender = filteredDailyData; // Pass daily data directly
        specialDatesToRender = monthlySpecialDates.filter(d =>
            d.originalDate >= startDate && d.originalDate < adjustedEndDate
        );

        renderTrendChart(
            container.select('#chart-trend'),
            dataToRender,
            specialDatesToRender,
            margin,
            width,
            height
        );
    } else {
        // Si no hay datos, mostrar un mensaje claro
        container.select('#chart-trend').html(
            '<p class="no-data">No hay datos disponibles para mostrar en la gráfica de tendencia.</p>'
        );
    }

    // Las gráficas de promedio por día de la semana y por mes del año siempre usan los datos completos
    // Se han eliminado las llamadas a renderWeekdayAvgChart y renderMonthAvgChart según la solicitud del usuario.
}

function renderTrendChart(container, data, specialDates, margin, width, height) {
    console.log('renderTrendChart - Iniciando renderizado...');
    console.log('Datos recibidos:', data ? data.length : 0, 'elementos');
    
    // Limpiar contenedor
    container.selectAll('*').remove();

    if (!data || data.length === 0) {
        console.error('No se recibieron datos para renderizar la gráfica');
        container.html('<p class="no-data">No hay datos suficientes para mostrar la gráfica de tendencia.</p>');
        return;
    }

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Asegurarse de que las fechas estén ordenadas
    const sortedData = [...data].sort((a, b) => a.date - b.date);

    // Filtrar datos para asegurar que tengan valores numéricos válidos
    const validData = sortedData.filter(d => {
        const value = d.circulaciones || d.total;
        const isValid = value !== null && value !== undefined && !isNaN(value) && isFinite(value);
        if (!isValid) {
            console.warn('Dato inválido encontrado:', d);
        }
        return isValid;
    });

    console.log('Datos válidos después de filtrar:', validData.length, 'de', sortedData.length);

    if (validData.length === 0) {
        const errorMsg = 'No hay datos numéricos válidos para mostrar la gráfica de tendencia. ' +
                       `Total de datos: ${sortedData.length}, Datos inválidos: ${sortedData.length - validData.length}`;
        console.error(errorMsg);
        container.html(`<p class="no-data">${errorMsg}</p>`);
        return;
    }

    // Obtener fechas mínima y máxima
    const dateExtent = d3.extent(validData, d => d.date);
    console.log('Extensión de fechas:', dateExtent[0], 'a', dateExtent[1]);
    
    const x = d3.scaleTime()
        .domain(dateExtent)
        .range([0, width]);

    // Calcular el dominio Y con un margen del 10% en la parte superior
    const yValues = validData.map(d => d.circulaciones || d.total);
    const yMin = d3.min(yValues);
    const yMax = d3.max(yValues);
    const yPadding = (yMax - yMin) * 0.1; // 10% de padding
    
    console.log('Valores Y - min:', yMin, 'max:', yMax, 'padding:', yPadding);
    
    const y = d3.scaleLinear()
        .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
        .nice()
        .range([height, 0]);
        
    console.log('Dominio Y final:', y.domain());

    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.circulaciones || d.total))
        .defined(d => {
            const value = d.circulaciones || d.total;
            return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
        });

    // Agregar área debajo de la línea
    const area = d3.area()
        .x(d => x(d.date))
        .y0(height)
        .y1(d => y(d.circulaciones || d.total))
        .defined(d => {
            const value = d.circulaciones || d.total;
            return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
        });

    // Área con degradado
    svg.append('defs').append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', 0).attr('y2', height)
        .selectAll('stop')
        .data([
            {offset: '0%', color: 'rgba(70, 130, 180, 0.3)'},
            {offset: '100%', color: 'rgba(70, 130, 180, 0.0)'}
        ])
        .enter().append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    // Dibujar el área
    svg.append('path')
        .datum(sortedData)
        .attr('fill', 'url(#area-gradient)')
        .attr('stroke', 'none')
        .attr('d', area);

    // Dibujar la línea
    svg.append('path')
        .datum(sortedData)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', line);

    // Determinar el intervalo de ticks basado en el rango de fechas
    const dateRange = d3.extent(data, d => d.date);
    const durationInDays = (dateRange[1] - dateRange[0]) / (1000 * 60 * 60 * 24);

    let tickInterval;
    if (durationInDays < 60) { // Menos de 2 meses
        tickInterval = d3.timeWeek.every(1); // Ticks semanales
    } else if (durationInDays < 365) { // Menos de 1 año
        tickInterval = d3.timeMonth.every(1); // Ticks mensuales
    } else { // 1 año o más
        tickInterval = d3.timeMonth.every(3); // Ticks cada 3 meses
    }

    const xAxis = d3.axisBottom(x)
        .tickFormat(d3.timeFormat('%b %Y')) // Formato más corto: Mes Año
        .ticks(tickInterval);

    const xAxisGroup = svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);

    // Rotar etiquetas del eje X
    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    // Eje Y con formato mejorado
    const yAxis = d3.axisLeft(y)
        .tickFormat(d3.format('~s')); // Formato de números grandes con sufijos K, M, etc.


    const yAxisGroup = svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    // Añadir línea de cuadrícula horizontal
    yAxisGroup.call(g => g.selectAll('.tick line')
        .clone()
        .attr('x2', width)
        .attr('stroke-opacity', 0.1));

    // Título del eje Y
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Circulaciones Diarias"); // Título actualizado

    // Puntos para eventos destacados
    if (specialDates && specialDates.length > 0) {
        const eventDots = svg.selectAll(".event-dot")
            .data(specialDates)
            .enter().append("g");

        // Línea que va desde el punto hasta el eje X
        eventDots.append("line")
            .attr("class", "event-line")
            .attr("x1", d => x(d.originalDate))
            .attr("x2", d => x(d.originalDate))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#ff6b6b")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.5);

        // Punto del evento
        const eventCircles = eventDots.append("circle")
            .attr("class", "event-dot")
            .attr("cx", d => x(d.originalDate)) // Posición X basada en la fecha original del evento
            .attr("cy", d => {
                // Encontrar el punto de datos diario correspondiente a la fecha exacta del evento
                const dataPoint = data.find(item =>
                    item.date.getTime() === d.originalDate.getTime()
                );
                // Usar el valor de circulaciones diarias para la posición Y
                return dataPoint ? y(dataPoint.circulaciones) : -100; // Usar -100 o similar si no hay datos para esa fecha
            })
            .attr("r", 5)
            .attr("fill", "#ff6b6b")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("cursor", "pointer")
            .on("mouseover", function(event, d) {
                const dataPoint = data.find(item => 
                    item.date.getFullYear() === d.originalDate.getFullYear() &&
                    item.date.getMonth() === d.originalDate.getMonth()
                );
                if (!dataPoint) return;

                const tooltipHtml = `<strong>${fullDateFormatter(d.originalDate)}</strong><br>Circulaciones: ${dataPoint.circulaciones || dataPoint.total}<br>Evento: ${d.eventInfo || 'Sin descripción'}`;
                tooltip.html(tooltipHtml)
                    .style('display', 'block')
                    .style('left', `${event.pageX + 10}px`)
                    .style('top', `${event.pageY - 20}px`);
            })
            .on("mouseout", function() {
                tooltip.style('display', 'none');
            });
    }

    // Cuadrícula horizontal
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat("")
        )
        .selectAll(".tick line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-opacity", 0.5);
}


// Función eliminada: renderWeekdayAvgChart no se utiliza

// Función eliminada: renderMonthAvgChart no se utiliza


function renderLegend(container, colorScale, minCirc, maxCirc) {
    container.selectAll('*').remove(); // Limpiar contenedor

    container.append('h3').text('Circulaciones Diarias');

    const legendWidth = LEGEND_SCALE_WIDTH;
    const legendHeight = 60; // Aumentar la altura para asegurar que las etiquetas del eje sean visibles

    const legendSvg = container.append('svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight);

    const legendScale = d3.scaleLinear()
        .domain([minCirc, maxCirc])
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(7) // Aumentar el número de ticks para mostrar más números
        .tickFormat(d3.format('d'));

    legendSvg.append('g')
        .attr('transform', `translate(0, 0)`)
        .call(legendAxis);

    // Crear un gradiente para la escala de color
    const linearGradient = legendSvg.append("defs")
        .append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    linearGradient.selectAll("stop")
        .data(colorScale.range())
        .enter().append("stop")
        .attr("offset", (d, i) => i / (colorScale.range().length - 1))
        .attr("stop-color", d => d);

    // Añadir un rectángulo para mostrar el gradiente
    legendSvg.append("rect")
        .attr("x", 0)
        .attr("y", 0) // Ajustar posición Y para que no se solape con el eje
        .attr("width", legendWidth)
        .attr("height", legendHeight / 2) // Reducir altura para dejar espacio al eje
        .style("fill", "url(#linear-gradient)");

     // Ajustar la posición del eje para que esté debajo del gradiente
     legendSvg.select('g')
         .attr('transform', `translate(0, ${legendHeight - 30})`); // Ajustar Y para dejar más espacio para las etiquetas
         // .style('border', '1px solid black'); // Borde temporal para depuración

     // Añadir etiqueta para 0 circulaciones
     container.append('div')
         .style('display', 'flex')
         .style('align-items', 'center')
         .style('margin-top', '10px')
         .html(`
             <span style="display: inline-block; width: 15px; height: 15px; background-color: ${EMPTY_COLOR}; margin-right: 5px; border-radius: 3px;"></span>
             <span>0 circulaciones</span>
         `);
}
// Función eliminada: renderBoxPlotMonthChart no se utiliza


function setupYearSelector(selector, dataByContractualYear, toggleChartsButton, calendarContainer, chartsContainer, dailyData, monthlySpecialDates) { // Añadir dailyData y monthlySpecialDates
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
             } else { // Si NO es vista de calendario (es vista de gráficas o vista única)
                 // Encontrar los datos del año seleccionado
                 const selectedYearKey = selectedYearId.replace('_', '-');
                 const yearData = dataByContractualYear.find(d => d.key === selectedYearKey);

                 // Comprobar si la vista de gráficas está visible
                 const isChartsViewVisible = !chartsContainer.classed('hidden');

                 if (isChartsViewVisible) {
                     if (yearData && yearData.values.length > 0) {
                         // Filtrar dailyData por el año contractual seleccionado
                         const filteredDailyData = yearData.values;

                         // Recalcular agregaciones para las gráficas con los datos filtrados
                         const filteredMonthlyTotals = aggregateMonthlyTotals(filteredDailyData);
                         const filteredDailyAvgByWeekday = aggregateDailyAvgByWeekday(filteredDailyData);
                         const filteredMonthlyAvgByMonth = aggregateMonthlyAvgByMonth(filteredDailyData);

                         // Filtrar fechas destacadas para el rango de fechas del año contractual
                         const startOfYear = d3.min(filteredDailyData, d => d.date);
                         const endOfYear = d3.max(filteredDailyData, d => d.date);
                         const filteredSpecialDates = monthlySpecialDates.filter(d => d.originalDate >= startOfYear && d.originalDate <= endOfYear);

                         // Renderizar gráficas con los datos filtrados
                         renderCharts(chartsContainer, filteredDailyData, filteredMonthlyTotals, filteredDailyAvgByWeekday, filteredMonthlyAvgByMonth, filteredSpecialDates); // Pasar filteredDailyData y filteredSpecialDates

                     } else {
                         // Mostrar mensaje de no hay datos para este año en las gráficas
                         chartsContainer.html('<p class="no-data">No hay datos disponibles para este año contractual en las gráficas.</p>');
                     }
                 }
                 // Si la vista única está activa, no hacer nada con el selector de año por ahora.
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
             yearDiv.append('h3').text(`Año Contrato ${contractualYearNumber} (${yearKey})`);

             const list = yearDiv.append('ul').attr('class', 'special-dates-list');

             datesInYear.forEach(dateInfo => {
                 list.append('li')
                     .html(`📅 <strong>${summaryDateFormatter(dateOnlyParser(dateInfo.fecha))}</strong>: ${dateInfo.evento}`); // Añadir icono de calendario
             });
         }
     });
}

/**
 * Configura la navegación por pestañas para cambiar entre las diferentes vistas de la aplicación
 * @param {Object} containers - Objeto que contiene los contenedores de las vistas
 * @param {Object} renderFunctions - Funciones de renderizado para cada vista
 * @param {Array} dailyData - Datos diarios para la aplicación
 * @param {Array} monthlySpecialDates - Fechas especiales mensuales
 * @param {Function} colorScale - Función de escala de colores
 */
function setupTabNavigation(containers, renderFunctions, dailyData, monthlySpecialDates, colorScale) {
    const {
        calendar: calendarContainer,
        charts: chartsContainer,
        single: singleViewContainer,
        time: timeAxisContainer,
        counter: counterContainer,
        files: filesContainer,
        chatbot: chatbotContainer
    } = containers;

    let currentView = 'single';

    /**
     * Actualiza la visibilidad de los elementos de la interfaz según la vista actual
     */
    const updateViewVisibility = () => {
        // Ocultar todos los contenedores de vista
        calendarContainer.classed('hidden', true);
        chartsContainer.classed('hidden', true);
        singleViewContainer.classed('hidden', true);
        timeAxisContainer.classed('hidden', true);
        counterContainer.classed('hidden', true);
        filesContainer.classed('hidden', true);
        chatbotContainer.classed('hidden', true);

        // Ocultar elementos de la interfaz por defecto
        dateFilterContainer.style('display', 'none');
        yearSelectorContainer.style('display', 'none');
        d3.select('#legend').style('display', 'none');

        // Actualizar la pestaña activa
        d3.selectAll('.nav-btn').classed('active', false);
        d3.select(`.nav-btn[data-view="${currentView}"]`).classed('active', true);

        // Configurar la vista actual
        switch (currentView) {
            case 'calendar':
                calendarContainer.classed('hidden', false);
                yearSelectorContainer.style('display', 'block');
                d3.select('#legend').style('display', 'block');
                renderFunctions.calendar();
                break;

            case 'charts':
                chartsContainer.classed('hidden', false);
                dateFilterContainer.style('display', 'flex');
                
                if (dailyData?.length > 0) {
                    const minDate = d3.min(dailyData, d => d.date);
                    const maxDate = d3.max(dailyData, d => d.date);
                    const startDate = startDateInput.node().value || (minDate ? esLocale.format('%Y-%m-%d')(minDate) : '');
                    const endDate = endDateInput.node().value || (maxDate ? esLocale.format('%Y-%m-%d')(maxDate) : '');

                    startDateInput.property('value', startDate);
                    endDateInput.property('value', endDate);

                    applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate);
                }
                break;

            case 'single':
                singleViewContainer.classed('hidden', false);
                d3.select('#legend').style('display', 'block');
                renderFunctions.single();
                break;

            case 'time':
                timeAxisContainer.classed('hidden', false);
                break;

            case 'counter':
                counterContainer.classed('hidden', false);
                renderFunctions.counter();
                break;
                
            case 'files':
                filesContainer.classed('hidden', false);
                // Aquí puedes agregar la lógica para cargar archivos si es necesario
                break;

            case 'chatbot':
                chatbotContainer.classed('hidden', false);
                renderFunctions.chatbot();
                break;
        }
    };

    /**
     * Maneja el evento de clic en una pestaña de navegación
     */
    const handleTabClick = function() {
        const targetView = d3.select(this).attr('data-view');
        
        if (targetView && targetView !== currentView) {
            currentView = targetView;
            updateViewVisibility();
            
            // Llamar a la función de renderizado correspondiente si existe
            if (renderFunctions[targetView]) {
                renderFunctions[targetView]();
            }
        }
    };

    // Configurar los manejadores de eventos para las pestañas
    d3.selectAll('.nav-btn')
        .on('click', handleTabClick)
        .on('keydown', function(event) {
            // Permitir la navegación con teclado (Enter o Espacio)
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleTabClick.call(this);
            }
        });

    // Inicializar la vista
    updateViewVisibility();
}

function renderSingleViewTable(container, dailyData, dataByContractualYear, colorScale, specialDatesMap) { // Añadir colorScale y specialDatesMap como argumentos
    container.selectAll('*').remove(); // Limpiar contenedor

    if (!dailyData || dailyData.length === 0) {
        container.html('<p class="no-data">No hay datos disponibles para la vista única.</p>');
        return;
    }
    
    // Función para posicionar el marcador de la fecha actual en el eje de tiempo

    const table = container.append('table').attr('class', 'single-view-table');
    const thead = table.append('thead');
    const tbody = table.append('tbody');

    // Crear cabecera de la tabla
    const headerRow = thead.append('tr');
    headerRow.append('th').html('AÑO').attr('rowspan', 2);
    headerRow.append('th').text('MES').attr('rowspan', 2);
    headerRow.append('th').text('Nº TRENES / DIA').attr('colspan', 31);
    headerRow.append('th').html('TOTAL<br>MES').attr('rowspan', 2).attr('class', 'total-mes-header');
    headerRow.append('th').html('TOTAL<br>AÑO').attr('rowspan', 2).attr('class', 'total-anyo-header');

    const daysRow = thead.append('tr');
    for (let i = 1; i <= 31; i++) {
        daysRow.append('th').text(i);
    }

    // Llenar cuerpo de la tabla
    dataByContractualYear.forEach((yearData, i) => {
        const yearKey = yearData.key;
        const yearValues = yearData.values;
        const contractualYearNumber = i + 1;
        const yearTotal = d3.sum(yearValues, d => d.circulaciones);

        const dataByMonth = d3.group(yearValues, d => d.date.getMonth());
        // Meses en orden contractual (Junio a Mayo)
        const monthOrder = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

        monthOrder.forEach(monthIndex => {
            const monthValues = dataByMonth.has(monthIndex) ? dataByMonth.get(monthIndex) : [];
            const monthTotal = d3.sum(monthValues, d => d.circulaciones);

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

             const monthName = esLocale.format('%b-%y')(firstDayOfMonth); // Formato corto ej: jun-13

             const row = tbody.append('tr')
                 .classed('last-month-row', monthIndex === 4); // Añadir clase si es el último mes del año contractual (Mayo)

             // Celda de Año Contrato (solo en la primera fila de cada año)
             if (monthIndex === monthOrder[0]) { // Si es el primer mes del año contractual
                 row.append('td')
                     .text(contractualYearNumber)
                     .attr('rowspan', monthOrder.length) // Ocupa todas las filas del año
                     .attr('class', 'year-contract-cell')
                     .style('border-right', '2px solid #a0a0a0'); /* Añadir borde derecho */
            }

            row.append('td').text(monthName);

            const monthDataLookup = new Map(monthValues.map(d => [d.date.getDate(), d.circulaciones]));

            for (let day = 1; day <= 31; day++) {
                const circulaciones = monthDataLookup.get(day);
                const cell = row.append('td');

                // Comprobar si el día existe en este mes
                const date = new Date(yearOfThisMonth, monthIndex, day);
                if (date.getMonth() === monthIndex && date.getDate() === day) {
                    const dateStr = dateFormatter(date); // Formatear la fecha para buscar en specialDatesMap
                    const eventInfo = specialDatesMap.get(dateStr);
                    const isHighlighted = specialDatesMap.has(dateStr);

                    // Mostrar vacío si no hay datos para ese día (null o undefined)
                    cell.text(circulaciones === null || circulaciones === undefined || circulaciones === '' ? '' : circulaciones);
                    
                    if (day === 1) {
                        cell.classed('day-1-cell', true); // Añadir clase para el primer día del mes
                    }
                    
                    cell.style('background-color', () => {
                        if (circulaciones === null || circulaciones === undefined || circulaciones === '') {
                            return '#ffffff'; // Blanco para celdas sin datos
                        }
                        return circulaciones === 0 ? '#f0f0f0' : colorScale(circulaciones); // Gris claro para 0, escala de color para > 0
                    });

                    if (isHighlighted) {
                        cell.classed('highlighted-single-view', true); // Añadir clase para destacar
                    }

                    // Añadir event listeners para el tooltip
                    cell.on('mouseover', function(event) {
                        let tooltipHtml = `<strong>${esLocale.format('%A, %d de %B de %Y')(date)}</strong><br>Circulaciones: ${(circulaciones === undefined || circulaciones === '') ? 'N/D' : circulaciones}`;
                        if (eventInfo) {
                            tooltipHtml = `⚠️ ${tooltipHtml}<div class="event-info">${eventInfo}</div>`;
                        }

                        tooltip.html(tooltipHtml)
                            .style('display', 'block')
                            .style('left', (event.pageX + 10) + 'px') // Posicionar a la derecha del cursor
                            .style('top', (event.pageY - 20) + 'px'); // Posicionar ligeramente encima del cursor
                    })
                    .on('mouseout', function() {
                        tooltip.style('display', 'none');
                    });

                } else {
                    cell.text('').attr('class', 'empty-day'); // Celda vacía para días que no existen
                }
            }

            row.append('td').text(monthTotal).attr('class', 'total-mes-cell');

            // Celda de Total Año (solo en la primera fila de cada año)
            if (monthIndex === monthOrder[0]) { // Si es el primer mes del año contractual
                 row.append('td')
                     .text(yearTotal)
                     .attr('rowspan', monthOrder.length) // Ocupa todas las filas del año
                     .attr('class', 'year-total-cell total-anyo-cell')
                     .style('border-left', '2px solid #a0a0a0'); /* Añadir borde izquierdo */
            }
        });
    });
}

// Funciones para procesar consultas del chatbot
const chatbotProcessor = {
    // Datos globales que se actualizarán cuando se carguen los datos
    data: null,
    specialDates: null,
    
    // Inicializar el procesador con los datos
    initialize: function(dailyData, specialDatesData) {
        this.data = dailyData;
        this.specialDates = specialDatesData;
        console.log('Chatbot processor initialized with data:', this.data ? this.data.length : 'null', 'records');
        console.log('Chatbot processor initialized with special dates:', this.specialDates ? this.specialDates.length : 'null', 'records');
        
        // Verificar que los datos tengan la estructura esperada
        if (this.data && this.data.length > 0) {
            console.log('Muestra de datos:', this.data[0]);
        }
    },
    
    // Procesar una consulta y devolver una respuesta
    processQuery: function(query) {
        console.log('Procesando consulta:', query);
        console.log('Estado de los datos:', this.data ? `${this.data.length} registros disponibles` : 'Sin datos');
        console.log('Estado de fechas especiales:', this.specialDates ? `${this.specialDates.length} fechas especiales disponibles` : 'Sin fechas especiales');
        
        // Convertir la consulta a minúsculas para facilitar la comparación
        const lowerQuery = query.toLowerCase();
        console.log('Consulta en minúsculas:', lowerQuery);
        
        // Patrones de consulta comunes (respuestas independientes de los datos)
        if (lowerQuery.includes('hola') || lowerQuery.includes('buenos días') || lowerQuery.includes('buenas tardes') || lowerQuery.includes('buenas noches')) {
            return '¡Hola! Soy el asistente virtual de circulaciones. ¿En qué puedo ayudarte?';
        }
        
        if (lowerQuery.includes('ayuda') || lowerQuery.includes('qué puedes hacer')) {
            return 'Puedo responder preguntas sobre las circulaciones de trenes entre Albacete y Alicante. Por ejemplo, puedes preguntarme sobre el número total de circulaciones, promedios por mes, días con más circulaciones, etc.';
        }
        
        // Verificar si los datos están disponibles
        if (!this.data || this.data.length === 0) {
            console.log('Error: No hay datos disponibles');
            return 'Lo siento, no tengo acceso a los datos en este momento. Prueba a preguntar "¿qué puedes hacer?" para ver las opciones disponibles.';
        }
        
        // Patrones de consulta comunes
        if (lowerQuery.includes('hola') || lowerQuery.includes('buenos días') || lowerQuery.includes('buenas tardes') || lowerQuery.includes('buenas noches')) {
            return '¡Hola! Soy el asistente virtual de circulaciones. ¿En qué puedo ayudarte?';
        }
        
        if (lowerQuery.includes('ayuda') || lowerQuery.includes('qué puedes hacer')) {
            return 'Puedo responder preguntas sobre las circulaciones de trenes entre Albacete y Alicante. Por ejemplo, puedes preguntarme sobre el número total de circulaciones, promedios por mes, días con más circulaciones, etc.';
        }
        
        // Consultas sobre datos totales
        if (lowerQuery.includes('total') && lowerQuery.includes('circulaciones')) {
            const total = this.getTotalCirculations();
            return `El número total de circulaciones registradas es de ${total}.`;
        }
        
        // Consultas sobre promedios
        if (lowerQuery.includes('promedio') || lowerQuery.includes('media')) {
            if (lowerQuery.includes('diario') || lowerQuery.includes('día') || lowerQuery.includes('por día')) {
                const avg = this.getAverageCirculationsPerDay();
                return `El promedio diario de circulaciones es de ${avg.toFixed(2)} trenes.`;
            }
            
            if (lowerQuery.includes('mensual') || lowerQuery.includes('mes') || lowerQuery.includes('por mes')) {
                const avg = this.getAverageCirculationsPerMonth();
                return `El promedio mensual de circulaciones es de ${avg.toFixed(2)} trenes.`;
            }
        }
        
        // Consultas sobre máximos y mínimos
        if (lowerQuery.includes('máximo') || lowerQuery.includes('máxima') || lowerQuery.includes('más')) {
            if ((lowerQuery.includes('circulaciones') || lowerQuery.includes('trenes')) && 
                (lowerQuery.includes('día') || lowerQuery.includes('días'))) {
                const max = this.getMaxCirculationsDay();
                return `El día con más circulaciones fue el ${max.date}, con ${max.count} trenes.`;
            } else if ((lowerQuery.includes('circulaciones') || lowerQuery.includes('trenes')) && 
                      (lowerQuery.includes('mes') || lowerQuery.includes('meses'))) {
                const maxMonth = this.getMaxCirculationsMonth();
                return `El mes con más circulaciones fue ${maxMonth.monthName} de ${maxMonth.year} con un total de ${maxMonth.total} circulaciones.`;
            } else if (lowerQuery.includes('circulaciones') || lowerQuery.includes('trenes')) {
                // Por defecto, si no se especifica, mostrar el día con más circulaciones
                const max = this.getMaxCirculationsDay();
                return `El día con más circulaciones fue el ${max.date}, con ${max.count} trenes.`;
            }
        }
        
        if (lowerQuery.includes('mínimo') || lowerQuery.includes('mínima') || lowerQuery.includes('menos')) {
            if ((lowerQuery.includes('circulaciones') || lowerQuery.includes('trenes'))) {
                if (lowerQuery.includes('mes')) {
                    const minMonth = this.getMinCirculationsMonth();
                    return `El mes con menos circulaciones en promedio fue ${minMonth.monthName} de ${minMonth.year} con un promedio de ${minMonth.average.toFixed(2)} trenes por día (total: ${minMonth.total} trenes).`;
                } else {
                    const min = this.getMinCirculationsDay();
                    return `El día con menos circulaciones (excluyendo días sin servicio) fue el ${min.date}, con ${min.count} trenes.`;
                }
            }
        }
        
        // Consultas sobre fechas específicas (formato: "circulaciones el 15 de junio de 2023")
        const dateMatch = lowerQuery.match(/(?:circulaciones|trenes)\s+(?:el|del|en el|en)\s+(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/);
        
        // Consultas sobre fechas en formato DD/MM/YYYY o DD-MM-YYYY (ej: 15/06/2023)
        const directDateMatch = !dateMatch && lowerQuery.match(/(\d{1,2})[\/\s-](\d{1,2})[\/\s-](\d{4})/);
        if (directDateMatch) {
            const [_, day, month, year] = directDateMatch;
            const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                             'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const monthIndex = parseInt(month) - 1;
            const dateInfo = this.getCirculationsForDate(parseInt(day), monthIndex, parseInt(year));
            
            if (dateInfo) {
                return `El ${day}/${month}/${year} hubo ${dateInfo.count} circulaciones.`;
            } else {
                return `No tengo información sobre circulaciones para la fecha ${day}/${month}/${year}.`;
            }
        }
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthName = dateMatch[2];
            const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
            
            const monthMap = {
                'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
                'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
            };
            
            const month = monthMap[monthName];
            const dateInfo = this.getCirculationsForDate(day, month, year);
            
            if (dateInfo) {
                return `El ${day} de ${monthName} de ${year} hubo ${dateInfo.count} circulaciones.`;
            } else {
                // Intentar con el formato de fecha directo (para consultas como '15/06/2023')
                const dateParts = query.match(/(\d{1,2})[\/\s-](\d{1,2})[\/\s-](\d{4})/);
                if (dateParts) {
                    const [_, queryDay, queryMonth, queryYear] = dateParts;
                    const altDateInfo = this.getCirculationsForDate(parseInt(queryDay), parseInt(queryMonth) - 1, parseInt(queryYear));
                    if (altDateInfo) {
                        return `El ${queryDay}/${queryMonth}/${queryYear} hubo ${altDateInfo.count} circulaciones.`;
                    }
                }
                return `No tengo información sobre circulaciones para el ${day} de ${monthName} de ${year}.`;
            }
        }
        
        // Consultas sobre meses específicos
        const monthMatch = lowerQuery.match(/(?:circulaciones|trenes)\s+(?:en|de|durante\s+el?)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?/);
        if (monthMatch) {
            const monthName = monthMatch[1];
            let year = monthMatch[2] ? parseInt(monthMatch[2]) : new Date().getFullYear();
            
            // Asegurarse de que el año sea un número válido
            if (isNaN(year) || year < 2000 || year > 2100) {
                year = new Date().getFullYear();
            }
            
            const monthMap = {
                'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
                'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
            };
            
            const month = monthMap[monthName];
            const monthInfo = this.getCirculationsForMonth(month, year);
            
            if (monthInfo && monthInfo.total > 0) {
                return `En ${monthName} de ${year} hubo un total de ${monthInfo.total} circulaciones, con un promedio diario de ${monthInfo.average.toFixed(2)} trenes.`;
            } else {
                return `No tengo información sobre circulaciones para ${monthName} de ${year}.`;
            }
        }
        
        // Consultas sobre años específicos - versión simplificada
        console.log('=== INICIO BÚSQUEDA DE AÑO ===');
        console.log('Consulta original:', query);
        
        // Buscar cualquier número de 4 dígitos en el texto
        const yearMatch = query.match(/(20\d{2})/);
        
        if (!yearMatch) {
            console.log('No se encontró ningún año en la consulta');
            return 'Por favor, especifica un año (por ejemplo: "circulaciones en 2023")';
        }
        
        const year = parseInt(yearMatch[1]);
        console.log('Año extraído:', year);
        
        // Validar que el año sea razonable
        if (year < 2000 || year > 2100) {
            console.log('Año fuera de rango:', year);
            return `El año ${year} está fuera del rango permitido (2000-2100).`;
        }
        
        console.log('Verificando datos para el año:', year);
        
        // Verificar si hay datos disponibles
        if (!this.data || this.data.length === 0) {
            console.log('No hay datos de circulaciones disponibles');
            return 'No hay datos de circulaciones disponibles para mostrar.';
        }
        
        // Verificar si hay datos para el año específico
        const yearData = this.data.filter(d => d.date.getFullYear() === year);
        console.log(`Datos encontrados para ${year}:`, yearData.length, 'registros');
        
        if (yearData.length === 0) {
            console.log(`No hay datos para el año ${year}`);
            return `No tengo información sobre circulaciones para el año ${year}.`;
        }
        
        // Obtener la información del año
        console.log('Obteniendo información del año...');
        const yearInfo = this.getCirculationsForYear(year);
        console.log('Información del año obtenida:', yearInfo);
        
        if (yearInfo && yearInfo.total > 0) {
            const response = `En el año ${year} hubo un total de ${yearInfo.total} circulaciones, con un promedio mensual de ${yearInfo.monthlyAverage.toFixed(2)} trenes.`;
            console.log('Respuesta generada:', response);
            return response;
        } else {
            console.log('No se encontraron datos válidos para el año', year);
            return `No se encontraron datos de circulaciones para el año ${year}.`;
        }
        
        // Consultas sobre fechas destacadas
        if (lowerQuery.includes('fecha') && (lowerQuery.includes('destacada') || lowerQuery.includes('especial') || lowerQuery.includes('importante'))) {
            const specialDateInfo = this.getSpecialDatesInfo();
            return specialDateInfo;
        }
        
        // Si no se reconoce la consulta
        return 'Lo siento, no entiendo tu consulta. Puedes preguntarme sobre el número total de circulaciones, promedios por mes, días con más circulaciones, etc.';
    },
    
    // Métodos para obtener información específica
    getTotalCirculations: function() {
        return this.data.reduce((total, d) => total + d.circulaciones, 0);
    },
    
    getAverageCirculationsPerDay: function() {
        const totalDays = this.data.filter(d => d.circulaciones > 0).length;
        const totalCirculations = this.getTotalCirculations();
        return totalCirculations / totalDays;
    },
    
    getAverageCirculationsPerMonth: function() {
        // Agrupar por mes y año usando d3.rollup
        const monthlyData = d3.rollup(
            this.data,
            v => d3.sum(v, d => d.circulaciones), // Sumar las circulaciones por mes
            d => `${d.date.getFullYear()}-${d.date.getMonth() + 1}` // Agrupar por año-mes
        );
        
        // Calcular el promedio
        const totalMonths = monthlyData.size;
        const totalCirculations = this.getTotalCirculations();
        return totalMonths > 0 ? totalCirculations / totalMonths : 0;
    },
    
    getMaxCirculationsDay: function() {
        const maxDay = d3.max(this.data, d => d.circulaciones);
        const maxDayData = this.data.find(d => d.circulaciones === maxDay);
        
        if (maxDayData) {
            const dateFormatter = d3.timeFormat('%d de %B de %Y');
            return {
                date: dateFormatter(maxDayData.date),
                count: maxDayData.circulaciones
            };
        }
        
        return { date: 'desconocido', count: 0 };
    },
    
    getMinCirculationsDay: function() {
        // Filtrar días con al menos una circulación para no considerar días sin servicio
        const daysWithCirculations = this.data.filter(d => d.circulaciones > 0);
        if (daysWithCirculations.length === 0) return { date: 'desconocido', count: 0 };
        
        let minDay = daysWithCirculations[0];
        daysWithCirculations.forEach(day => {
            if (day.circulaciones < minDay.circulaciones) {
                minDay = day;
            }
        });
        
        const dateFormatter = d3.timeFormat('%d de %B de %Y');
        return {
            date: dateFormatter(minDay.date),
            count: minDay.circulaciones
        };
    },
    
    getMinCirculationsMonth: function() {
        // Agrupar por mes y año
        const monthlyData = {};
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        this.data.forEach(day => {
            const year = day.date.getFullYear();
            const month = day.date.getMonth();
            const key = `${year}-${month}`;
            
            if (!monthlyData[key]) {
                monthlyData[key] = {
                    year: year,
                    month: month,
                    monthName: monthNames[month],
                    total: 0,
                    days: 0
                };
            }
            
            monthlyData[key].total += day.circulaciones;
            monthlyData[key].days++;
        });
        
        // Encontrar el mes con menos circulaciones
        let minMonth = null;
        let minAverage = Infinity;
        
        Object.values(monthlyData).forEach(monthData => {
            const average = monthData.total / monthData.days;
            if (average < minAverage) {
                minAverage = average;
                minMonth = monthData;
            }
        });
        
        if (minMonth) {
            return {
                year: minMonth.year,
                month: minMonth.month,
                monthName: minMonth.monthName,
                total: minMonth.total,
                average: minAverage
            };
        }
        
        return { year: 0, month: 0, monthName: 'desconocido', total: 0, average: 0 };
    },
    
    getMaxCirculationsMonth: function() {
        // Agrupar por mes y año
        const monthlyData = {};
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        this.data.forEach(day => {
            const year = day.date.getFullYear();
            const month = day.date.getMonth();
            const key = `${year}-${month}`;
            
            if (!monthlyData[key]) {
                monthlyData[key] = {
                    year: year,
                    month: month,
                    monthName: monthNames[month],
                    total: 0,
                    days: 0
                };
            }
            
            monthlyData[key].total += day.circulaciones;
            monthlyData[key].days++;
        });
        
        // Encontrar el mes con más circulaciones
        let maxMonth = null;
        Object.values(monthlyData).forEach(monthData => {
            if (!maxMonth || monthData.total > maxMonth.total) {
                maxMonth = monthData;
            }
        });
        
        if (maxMonth) {
            return {
                year: maxMonth.year,
                month: maxMonth.month,
                monthName: maxMonth.monthName,
                total: maxMonth.total,
                average: maxMonth.total / maxMonth.days
            };
        }
        
        return { year: 0, month: 0, monthName: 'desconocido', total: 0, average: 0 };
    },
    
    getCirculationsForDate: function(day, month, year) {
        // Asegurarse de que el mes esté en el rango correcto (0-11)
        month = parseInt(month);
        year = parseInt(year);
        day = parseInt(day);
        
        // Buscar en los datos una coincidencia exacta de día, mes y año
        const dayData = this.data.find(d => {
            const dDate = d.date;
            return dDate.getDate() === day && 
                   dDate.getMonth() === month && 
                   dDate.getFullYear() === year;
        });
        
        console.log(`Buscando fecha: ${day}/${month + 1}/${year}`, 'Resultado:', dayData);
        
        if (dayData) {
            return {
                date: d3.timeFormat('%d/%m/%Y')(dayData.date),
                count: dayData.circulaciones
            };
        }
        
        return null;
    },
    
    getCirculationsForMonth: function(month, year) {
        // Filtrar datos para el mes y año especificados
        const monthData = this.data.filter(d => d.date.getMonth() === month && d.date.getFullYear() === year);
        
        if (monthData.length > 0) {
            const total = monthData.reduce((sum, d) => sum + d.circulaciones, 0);
            const average = total / monthData.length;
            
            return {
                total: total,
                average: average
            };
        }
        
        return null;
    },
    
    getCirculationsForYear: function(year) {
        // Filtrar datos para el año especificado
        const yearData = this.data.filter(d => d.date.getFullYear() === year);
        
        if (yearData.length > 0) {
            const total = yearData.reduce((sum, d) => sum + d.circulaciones, 0);
            
            // Calcular promedio mensual usando d3.rollup
            const monthlyData = d3.rollup(
                yearData,
                values => d3.sum(values, d => d.circulaciones), // Suma de circulaciones por mes
                d => d.date.getMonth() // Agrupar por mes
            );
            
            const monthlyAverage = monthlyData.size > 0 ? total / monthlyData.size : 0;
            
            return {
                total: total,
                monthlyAverage: monthlyAverage
            };
        }
        
        return null;
    },
    
    getSpecialDatesInfo: function() {
        if (!this.specialDates || this.specialDates.length === 0) {
            return 'No hay información sobre fechas destacadas.';
        }
        
        // Obtener la fecha más reciente
        const latestSpecialDate = this.specialDates.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
        
        if (latestSpecialDate) {
            const dateFormatter = d3.timeFormat('%d de %B de %Y');
            const date = dateOnlyParser(latestSpecialDate.fecha);
            
            return `La fecha destacada más reciente es el ${dateFormatter(date)}: ${latestSpecialDate.descripcion}`;
        }
        
        return 'No hay información sobre fechas destacadas.';
    }
};

function renderChatbotView(container) {
    // Limpiar el contenedor
    container.html('');
    
    // Crear la estructura del chatbot
    const chatbotHeader = container.append('div')
        .attr('class', 'chatbot-header')
        .html('<h2>Asistente Virtual de Circulaciones</h2>');
    
    // Contenedor de mensajes
    const chatMessages = container.append('div')
        .attr('class', 'chat-messages');
    
    // Mensaje de bienvenida
    const welcomeMessage = chatMessages.append('div')
        .attr('class', 'chat-message bot-message');
        
    welcomeMessage.append('div')
        .attr('class', 'chat-avatar bot-avatar')
        .html('🤖');
        
    welcomeMessage.append('div')
        .attr('class', 'message-content')
        .html('<p>Bienvenido al asistente virtual de circulaciones. ¿En qué puedo ayudarte?</p>');
    
    // Área de entrada
    const inputArea = container.append('div')
        .attr('class', 'chat-input-area');
    
    const chatInput = inputArea.append('input')
        .attr('type', 'text')
        .attr('placeholder', 'Escribe tu pregunta aquí...')
        .attr('id', 'chat-input');
    
    const sendButton = inputArea.append('button')
        .attr('id', 'send-chat')
        .text('Enviar');
    
    // Funcionalidad para enviar mensajes
    function sendMessage() {
        const message = chatInput.property('value').trim();
        if (message) {
            // Añadir mensaje del usuario
            const userMessageDiv = chatMessages.append('div')
                .attr('class', 'chat-message user-message');
                
            userMessageDiv.append('div')
                .attr('class', 'chat-avatar user-avatar')
                .html('🧑')
                .style('font-size', '20px')
                .style('background-color', '#e3f2fd')
                .style('color', '#1976d2');
                
            userMessageDiv.append('div')
                .attr('class', 'message-content')
                .html(`<p>${message}</p>`);
            
            // Limpiar input
            chatInput.property('value', '');
            
            // Hacer scroll hacia abajo
            const messagesContainer = document.querySelector('.chat-messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Mostrar indicador de escritura
            const typingIndicator = chatMessages.append('div')
                .attr('class', 'chat-message bot-message typing-indicator');
                
            typingIndicator.append('div')
                .attr('class', 'chat-avatar bot-avatar')
                .html('🤖');
                
            typingIndicator.append('div')
                .attr('class', 'message-content')
                .html('<div class="typing"><span></span><span></span><span></span></div>');
                
            // Hacer scroll hacia abajo para mostrar el indicador
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Actualizar sugerencias después de enviar
            renderSuggestions();
            
            // Simular tiempo de respuesta
            setTimeout(() => {
                // Eliminar indicador de escritura
                typingIndicator.remove();
                
                // Obtener respuesta del procesador de chatbot
                const response = chatbotProcessor.processQuery(message);
                
                // Añadir respuesta del bot
                const botMessageDiv = chatMessages.append('div')
                    .attr('class', 'chat-message bot-message');
                    
                botMessageDiv.append('div')
                    .attr('class', 'chat-avatar bot-avatar')
                    .html('🤖');
                    
                botMessageDiv.append('div')
                    .attr('class', 'message-content')
                    .html(`<p>${response}</p>`);
                
                // Hacer scroll hacia abajo para mostrar el último mensaje
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Actualizar sugerencias después de la respuesta
                renderSuggestions();
            }, 2000);
        }
    }
    
    // Preguntas de ejemplo compatibles con el chatbot
    const allExampleQuestions = [
        'Total de circulaciones',
        'Promedio diario de circulaciones',
        'Promedio mensual de circulaciones',
        'Día con más circulaciones',
        'Día con menos circulaciones',
        'Circulaciones el 15/06/2023',
        'Circulaciones en enero 2024',
        'Fechas especiales',
        'Circulaciones en 2023',
        'Mes con más circulaciones',
        'Mes con menos circulaciones',
        '¿Qué puedes hacer?'
    ];
    
    // Crear contenedor para las sugerencias
    const suggestionsContainer = container.append('div')
        .attr('class', 'suggestions-container');
        
    // Función para renderizar las sugerencias
    function renderSuggestions() {
        // Limpiar sugerencias existentes
        const existingRow = suggestionsContainer.select('.suggestions-row');
        if (!existingRow.empty()) {
            existingRow.remove();
        }
        
        // Seleccionar 4 preguntas aleatorias
        const shuffled = [...allExampleQuestions]
            .filter(q => q !== chatInput.property('value')) // No mostrar la pregunta actual
            .sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, 4);
        
        // Añadir burbujas de sugerencias
        const suggestionsRow = suggestionsContainer.insert('div', ':first-child')
            .attr('class', 'suggestions-row');
            
        selectedQuestions.forEach(question => {
            suggestionsRow.append('div')
                .attr('class', 'suggestion-bubble')
                .text(question)
                .on('click', function() {
                    // Establecer la pregunta en el input
                    chatInput.property('value', question);
                    // Enfocar el input
                    chatInput.node().focus();
                });
        });
    }
    
    // Inicializar sugerencias
    renderSuggestions();
    
    // Botón para actualizar sugerencias manualmente
    suggestionsContainer.append('div')
        .attr('class', 'refresh-suggestions')
        .html('🔄 Otras preguntas')
        .on('click', renderSuggestions);
        
    // Actualizar sugerencias después de enviar un mensaje
    const originalSendMessage = sendMessage;
    sendMessage = function() {
        const result = originalSendMessage.apply(this, arguments);
        // Pequeño retraso para asegurar que el mensaje se haya procesado
        setTimeout(renderSuggestions, 100);
        return result;
    };
    
    // Event listeners
    sendButton.on('click', sendMessage);
    
    chatInput.on('keypress', function(event) {
        // Usar el evento nativo o el evento d3 según la versión
        const keyCode = event.keyCode || d3.event.keyCode || event.which;
        if (keyCode === 13) { // Enter key
            event.preventDefault(); // Prevenir el comportamiento por defecto
            sendMessage();
        }
    });
    
    // Las sugerencias permanecen visibles en todo momento
}

function renderCounterView(container) {
    container.selectAll('*').remove(); // Limpiar contenedor

    // Obtener los datos ya cargados en lugar de hacer una nueva petición
    const dailyData = window.dailyData || [];
    
    if (dailyData.length === 0) {
        container.html('<p class="error">No se han podido cargar los datos. Por favor, recargue la página.</p>');
        console.error('No hay datos disponibles para mostrar el contador');
        return;
    }

    // Fecha de inauguración
    const inaugurationDate = new Date(2013, 5, 17); // 17 de junio de 2013 (mes 5 porque en JavaScript los meses empiezan en 0)
    const currentDate = new Date();
    
    // Calcular días de servicio
    const daysInService = Math.floor((currentDate - inaugurationDate) / (1000 * 60 * 60 * 24));
    
    // Calcular total de circulaciones
    const totalCirculations = dailyData.reduce((sum, day) => sum + (day.circulaciones || 0), 0);
    const averageDaily = totalCirculations / dailyData.length;

    // Crear el SVG para el contador
    const svg = container.append('svg')
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('viewBox', '0 0 800 500'); // Aumentar altura para la tarjeta adicional

    // Título
    svg.append('text')
        .attr('x', 400)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .attr('font-size', '30px')
        .attr('font-family', 'Arial, sans-serif')
        .attr('font-weight', 'bold')
        .text('Días de Servicio Ininterrumpido');

    // Número grande (con animación)
    const counterText = svg.append('text')
        .attr('x', 400)
        .attr('y', 160)
        .attr('text-anchor', 'middle')
        .attr('font-size', '130px')
        .attr('font-family', 'Arial, sans-serif')
        .attr('font-weight', 'bold')
        .style('fill', '#20639B')
        .text('0'); // Empezar desde 0

    // Subtítulo
    svg.append('text')
        .attr('x', 400)
        .attr('y', 210) // Cambiado de 250 a 200 para acercarlo al número
        .attr('text-anchor', 'middle')
        .attr('font-size', '26px')
        .attr('font-family', 'Arial, sans-serif')
        .style('fill', '#495057')
        .text('desde la inauguración el 17 de junio de 2013');

    // Animación del contador
    const duration = 2000; // Duración de la animación en milisegundos
    
    // Definir un formateador personalizado con punto como separador de miles
    const formatNumber = (value) => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
    
    // Crear la animación usando d3.transition
    counterText.transition()
        .duration(duration)
        .tween("text", function() {
            const i = d3.interpolateNumber(0, daysInService);
            return function(t) {
                // Usar Math.round para evitar decimales durante la animación
                const currentValue = Math.round(i(t));
                // Formatear con puntos como separadores de miles
                this.textContent = formatNumber(currentValue);
            };
        })
        .ease(d3.easeCubicOut); // Tipo de aceleración (más lento al final)
        
    // Calcular el total real de circulaciones sumando todos los datos
    // Primero, cargar los datos si aún no están disponibles
    d3.json('datos.json').then(rawData => {
        // Procesar los datos
        const dailyData = processRawData(rawData);
        // Sumar todas las circulaciones
        const totalCirculations = d3.sum(dailyData, d => d.circulaciones);
        
        // Encontrar el día con mayor número de circulaciones
        const maxDay = dailyData.reduce((max, current) => {
            return (current.circulaciones > max.circulaciones) ? current : max;
        }, { circulaciones: 0 });
        
        // Formato de fecha para el día con máxima circulación
        const maxDayFormatted = esLocale.format('%d de %B de %Y')(maxDay.date);
        
        // Crear un rectángulo para la tarjeta del total de circulaciones
        svg.append('rect')
            .attr('x', 100)  // Posición más a la izquierda para dar más espacio
            .attr('y', 270)
            .attr('width', 280) // Tarjeta más ancha
            .attr('height', 120)
            .attr('rx', 15)
            .attr('ry', 15)
            .attr('fill', '#e3f2fd')
            .attr('stroke', '#90caf9')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))')
            .style('transition', 'transform 0.2s ease-in-out')
            .on('mouseover', function() {
                d3.select(this).style('transform', 'scale(1.02)');
            })
            .on('mouseout', function() {
                d3.select(this).style('transform', 'scale(1)');
            });
            
        // Título de la tarjeta del total
        svg.append('text')
            .attr('x', 240)  // Ajustado al centro de la primera tarjeta
            .attr('y', 300)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .style('fill', '#495057')
            .text('Total de Trenes Circulados');
            
        // Número de trenes (con animación)
        const trainCounterText = svg.append('text')
            .attr('x', 240)  // Ajustado al centro de la primera tarjeta
            .attr('y', 350)
            .attr('text-anchor', 'middle')
            .attr('font-size', '36px')
            .attr('font-weight', 'bold')
            .style('fill', '#dc3545')
            .text('0');
            
        // Animación del contador de trenes
        trainCounterText.transition()
            .duration(duration)
            .tween("text", function() {
                const i = d3.interpolateNumber(0, totalCirculations);
                return function(t) {
                    const currentValue = Math.round(i(t));
                    this.textContent = formatNumber(currentValue);
                };
            })
            .ease(d3.easeCubicOut);

        // Encontrar la última fecha con datos diferentes de 0
        let lastDateWithData = null;
        for (let i = dailyData.length - 1; i >= 0; i--) {
            if (dailyData[i].circulaciones > 0) {
                lastDateWithData = dailyData[i].date;
                break;
            }
        }

        // Formatear la última fecha con datos
        const lastDateFormatted = lastDateWithData ? esLocale.format('%d de %B de %Y')(lastDateWithData) : 'No hay datos';

        // Mostrar la última fecha con datos
        svg.append('text')
            .attr('x', 240)  // Ajustado al centro de la primera tarjeta
            .attr('y', 380)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .style('fill', '#6c757d')
            .text(`Datos hasta: ${lastDateFormatted}`);

        // Crear un rectángulo para la tarjeta del día máximo
        svg.append('rect')
            .attr('x', 420)  // Posicionado a la derecha con espacio simétrico entre tarjetas
            .attr('y', 270)
            .attr('width', 280)  // Tarjeta más ancha
            .attr('height', 120)
            .attr('rx', 15)
            .attr('ry', 15)
            .attr('fill', '#e8f5e9')
            .attr('stroke', '#a5d6a7')
            .attr('stroke-width', 2)
                        .attr('filter', 'drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))')
                        .style('transition', 'transform 0.2s ease-in-out')
                        .on('mouseover', function() {
                            d3.select(this).style('transform', 'scale(1.02)');
                        })
                        .on('mouseout', function() {
                            d3.select(this).style('transform', 'scale(1)');
                        });
            
        // Título de la tarjeta del día máximo
        svg.append('text')
            .attr('x', 560)  // Ajustado al centro de la segunda tarjeta
            .attr('y', 300)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .style('fill', '#495057')
            .text('Día con Máxima Circulación');
            
        // Mostrar el número máximo de trenes
        svg.append('text')
            .attr('x', 560)  // Ajustado al centro de la segunda tarjeta
            .attr('y', 350)
            .attr('text-anchor', 'middle')
            .attr('font-size', '36px')
            .attr('font-weight', 'bold')
            .style('fill', '#28a745')  // Color verde para diferenciarlo
            .text(formatNumber(maxDay.circulaciones));
            
        // Mostrar la fecha del día máximo
        svg.append('text')
            .attr('x', 560)  // Ajustado al centro de la segunda tarjeta
            .attr('y', 380)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .style('fill', '#6c757d')
            .text(maxDayFormatted);
    }).catch(error => {
        console.error("Error al cargar los datos para el contador de circulaciones:", error);
        // En caso de error, mostrar un mensaje en la tarjeta
        svg.append('rect')
            .attr('x', 150)
            .attr('y', 270)
            .attr('width', 240)
            .attr('height', 120)
            .attr('rx', 15)
            .attr('ry', 15)
            .attr('fill', '#d1d5db')
            .attr('stroke', '#64748b')
            .attr('stroke-width', 2)
                        .attr('filter', 'drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))')
                        .style('transition', 'transform 0.2s ease-in-out')
                        .on('mouseover', function() {
                            d3.select(this).style('transform', 'scale(1.02)');
                        })
                        .on('mouseout', function() {
                            d3.select(this).style('transform', 'scale(1)');
                        });
            
        svg.append('text')
            .attr('x', 270)
            .attr('y', 330)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .style('fill', '#dc3545')
            .text('Error al cargar datos de circulaciones');
    });
}

// En la función setupViewToggle, modificar la vista counter
const handleViewButtonClick = function() {
    const buttonText = d3.select(this).text();
    let targetView;

    switch (buttonText) {
        case 'CALENDARIO':
            targetView = 'calendar';
            break;
        case 'GRAFICOS':
            targetView = 'charts';
            break;
        case 'VISTA UNICA':
            targetView = 'single';
            break;
        case 'EJE TIEMPO':
            targetView = 'time';
            break;
        case 'CONTADOR':
            targetView = 'counter';
            break;
    }

    if (targetView !== currentView) {
        currentView = targetView;
        updateViewVisibility();
        renderFunctions[targetView]();
    }
};

// Función para aplicar el filtro de fecha y renderizar las gráficas
function applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate) {
    console.log('applyDateFilterAndRender - Iniciando...');
    
    // Asegurarse de que las fechas sean objetos Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log('Fechas recibidas - Inicio:', start, 'Fin:', end);
    console.log('Total de datos diarios recibidos:', dailyData.length);
    
    // Ajustar la fecha de fin para incluir todo el día seleccionado
    const adjustedEndDate = d3.timeDay.offset(end, 1);

    // Normalizar las fechas para comparación (establecer a mediodía para evitar problemas de zona horaria)
    const normalizeDate = (date) => {
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return d;
    };

    const normalizedStart = normalizeDate(start);
    const normalizedEnd = normalizeDate(adjustedEndDate);
    
    console.log('Rango normalizado - Inicio:', normalizedStart, 'Fin:', normalizedEnd);

    // Filtrar los datos diarios por el rango de fechas
    const filteredDailyData = dailyData.filter(d => {
        const date = normalizeDate(d.date);
        return date >= normalizedStart && date < normalizedEnd;
    });
    
    console.log('Datos filtrados en el rango:', filteredDailyData.length);
    
    // Si no hay datos, mostrar los primeros 10 registros para depuración
    if (filteredDailyData.length === 0 && dailyData.length > 0) {
        console.log('Muestra de los primeros 10 registros disponibles:');
        dailyData.slice(0, 10).forEach((d, i) => {
            console.log(`[${i}]`, d.date, 'circulaciones:', d.circulaciones);
        });
    }

    if (filteredDailyData.length > 0) {
        console.log('Datos válidos encontrados, procediendo a renderizar...');
        // Recalcular agregaciones mensuales para la gráfica de tendencia con los datos filtrados
        const filteredMonthlyTotals = aggregateMonthlyTotals(filteredDailyData);

        // Filtrar fechas destacadas para el rango de fechas seleccionado
        const filteredSpecialDates = monthlySpecialDates.filter(d => d.originalDate >= startDate && d.originalDate < adjustedEndDate);

        // Renderizar solo la gráfica de tendencia con los datos filtrados
        const margin = { top: 20, right: 30, bottom: 60, left: 60 };
        const containerNode = chartsContainer.node();
        // Asegurar que containerNode no es null antes de obtener su ancho
        const containerWidth = containerNode ? parseInt(containerNode.getBoundingClientRect().width) : 960;
        const width = containerWidth - margin.left - margin.right;
        let height = 300;

        console.log('Llamando a renderTrendChart con ancho:', width, 'y alto:', height);
        console.log('Selector del contenedor de la gráfica:', chartsContainer.select('#chart-trend').size() > 0 ? 'Encontrado' : 'No encontrado');
        
        // Verificar que los datos tengan la estructura esperada
        if (filteredDailyData.length > 0) {
            console.log('Primer elemento de datos:', filteredDailyData[0]);
        }

        renderTrendChart(chartsContainer.select('#chart-trend'), filteredDailyData, filteredSpecialDates, margin, width, height); // Pasar filteredDailyData y filteredSpecialDates

        // Opcional: Limpiar o mostrar mensaje en las otras gráficas si no se aplican a este filtro
        // chartsContainer.select('#chart-weekday').html('');
        // chartsContainer.select('#chart-month').html('');

    } else {
        chartsContainer.select('#chart-trend').html('<p class="no-data">No hay datos disponibles para el rango de fechas seleccionado.</p>');
    }
}


// Función para configurar el filtro de fecha
function setupDateFilter(dailyData, chartsContainer, colorScale, monthlySpecialDates) {
    // Determinar la primera y última fecha disponible en los datos
    const firstAvailableDate = dailyData.length > 0 ? dailyData[0].date : new Date();
    const lastAvailableDate = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : new Date();
    const minDateString = dateFormatter(firstAvailableDate);
    const maxDateString = dateFormatter(lastAvailableDate);

    // Establecer los atributos 'min' y 'max' en los selectores de fecha
    startDateInput.attr('min', minDateString);
    startDateInput.attr('max', maxDateString);
    endDateInput.attr('min', minDateString);
    endDateInput.attr('max', maxDateString);

    // Establecer fechas por defecto (18/06/2013 a la fecha más reciente)
    const defaultStartDate = new Date(2013, 5, 18); // 18 de junio de 2013

    // Find the last date with non-zero circulation for the default end date
    let lastNonZeroCirculationDateForDefault = new Date(); // Default to current date if no data found
    for (let i = dailyData.length - 1; i >= 0; i--) {
        if (dailyData[i].circulaciones !== null && dailyData[i].circulaciones > 0) {
            lastNonZeroCirculationDateForDefault = dailyData[i].date;
            break;
        }
    }
    const defaultEndDate = lastNonZeroCirculationDateForDefault;

    // Formatear fechas para los inputs
    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    // Establecer valores en los inputs
    startDateInput.property('value', formatDateForInput(defaultStartDate));
    endDateInput.property('value', formatDateForInput(defaultEndDate));

    // Función para aplicar el filtro
    const applyFilter = () => {
        const startDateStr = startDateInput.property('value');
        const endDateStr = endDateInput.property('value');

        const startDate = dateOnlyParser(startDateStr);
        const endDate = dateOnlyParser(endDateStr);

        if (!startDate || !endDate) {
            console.warn("Fechas inválidas");
            return;
        }


        if (startDate > endDate) {
            console.warn("La fecha de inicio no puede ser posterior a la fecha de fin");
            return;
        }


        applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate);
    };

    // Configurar evento del botón
    applyDateFilterButton.on('click', applyFilter);
    
    // Aplicar el filtro automáticamente después de un breve retraso
    setTimeout(applyFilter, 100);
}

// Función para configurar los filtros rápidos
function setupQuickFilters(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDateInput, endDateInput, applyDateFilterAndRender) {
    const quickFiltersContainer = d3.select('#quick-filters-container');
    if (quickFiltersContainer.empty()) {
        console.warn("Contenedor de filtros rápidos no encontrado.");
        return;
    }

    // Define los filtros rápidos con sus rangos de fecha
    const quickFilters = [
        { label: "Inauguración - Pre-Pandemia", startDate: "2013-06-17", endDate: "2020-03-13" },
        { label: "1er Estado Alarma COVID-19", startDate: "2020-02-13", endDate: "2020-06-20" },
        { label: "Recuperación Post-Alarma", startDate: "2020-05-20", endDate: "2023-03-26" },
        { label: "Entrada nuevos Operadores", startDate: "2022-11-20", endDate: "2023-07-23" },
        { label: "Temporal Filomena", startDate: "2021-01-04", endDate: "2021-01-15" },
        { label: "Incidencia Catenaria Oct 2023", startDate: "2023-09-13", endDate: "2023-11-13" }
    ];

    // Crear botones para cada filtro
    const filterButtons = quickFiltersContainer.selectAll(".quick-filter-button")
        .data(quickFilters)
        .enter().append("button")
        .attr("class", "quick-filter-button") // Clase CSS para estilizar como burbuja
        .text(d => d.label)
        .on("click", function(event, d) {
            // Aplicar el filtro al hacer clic
            const startDate = dateOnlyParser(d.startDate);
            const endDate = dateOnlyParser(d.endDate);

            if (startDate && endDate) {
                // Actualizar los inputs de fecha en la interfaz
                const formatDateForInput = (date) => date.toISOString().split('T')[0];
                startDateInput.property('value', formatDateForInput(startDate));
                endDateInput.property('value', formatDateForInput(endDate));

                // Aplicar el filtro y redibujar las gráficas
                applyDateFilterAndRender(dailyData, chartsContainer, colorScale, monthlySpecialDates, startDate, endDate);
            } else {
                console.error("Fechas inválidas para el filtro rápido:", d.label);
            }
        });
}


// Función para manejar la descarga de archivos
function setupFileDownloads() {
    // Botón de descarga de Excel
    document.getElementById('download-excel')?.addEventListener('click', function() {
        // Crear un enlace temporal para la descarga
        const link = document.createElement('a');
        link.href = 'Circulaciones ALBALI.xlsm';
        link.download = 'Circulaciones ALBALI.xlsm';
        
        // Simular clic para iniciar la descarga
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Iniciando descarga de: Circulaciones ALBALI.xlsm');
    });

    // Botón de descarga de Informe
    document.getElementById('download-report')?.addEventListener('click', function() {
        // Crear un enlace temporal para la descarga
        const link = document.createElement('a');
        link.href = 'Informe Circulaciones ALBALI.pdf';
        link.download = 'Informe Circulaciones ALBALI.pdf';
        
        // Simular clic para iniciar la descarga
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Iniciando descarga de: Informe Circulaciones ALBALI.pdf');
    });
}

// Iniciar la aplicación al cargar el script
document.addEventListener('DOMContentLoaded', function() {
    initializeVisualization();
    setupFileDownloads();
});

// Script for Time Axis View animation and responsiveness
document.addEventListener('DOMContentLoaded', function() {
    // Animación de los eventos del cronograma
    const timelineEvents = document.querySelectorAll('.timeline-event');

    function checkVisibility() {
        timelineEvents.forEach(event => {
            const eventPosition = event.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.2;

            if (eventPosition < screenPosition) {
                const delay = parseInt(event.getAttribute('data-delay')) || 0;
                setTimeout(() => {
                    event.classList.add('visible');
                }, delay);
            }
        });
    }

    // Verificar visibilidad al cargar y al hacer scroll
    window.addEventListener('scroll', checkVisibility);
    checkVisibility();

    // Adaptación responsive para móviles
    function handleResize() {
        const timelineLine = document.querySelector('.timeline-line');
        const events = document.querySelectorAll('.timeline-event');

        if (timelineLine) {
            if (window.innerWidth <= 768) {
                timelineLine.style.left = '40px';
                events.forEach(event => {
                    const icon = event?.querySelector('.event-icon');
                    if (icon) icon.style.left = '40px';
                });
            } else {
                timelineLine.style.left = '50%';
                events.forEach(event => {
                    const icon = event?.querySelector('.event-icon');
                    if (icon) icon.style.left = '50%';
                });
            }
        }
    }

    // Solo agregar el event listener si estamos en la vista de timeline
    if (document.querySelector('.timeline-line')) {
        window.addEventListener('resize', handleResize);
        // Usar setTimeout para asegurar que el DOM esté listo
        setTimeout(handleResize, 100);
    }
});

// Función para actualizar la fecha actual en el eje de tiempo
function updateCurrentDateDisplay() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('es-ES', options);
    const dateElement = d3.select('#current-date-display');
    if (!dateElement.empty()) {
        dateElement.text(formattedDate);
    }
}

// Función para ajustar la posición de las líneas del tiempo pasado y futuro
function updateTimelineLinePosition() {
    const currentDateEvent = document.querySelector('.timeline-event.current-date-event');
    const timelinePast = document.querySelector('.timeline-line-past');
    const timelineFuture = document.querySelector('.timeline-line-future');
    const timelineContainer = document.querySelector('.timeline-container');

    if (currentDateEvent && timelinePast && timelineFuture && timelineContainer) {
        const containerRect = timelineContainer.getBoundingClientRect();
        const eventRect = currentDateEvent.getBoundingClientRect();

        // Calcular la posición vertical del centro del evento respecto al contenedor del timeline
        const eventCenterRelativeToContainer = eventRect.top + eventRect.height / 2 - containerRect.top;

        // Ajustar la altura de la línea pasada
        timelinePast.style.bottom = `calc(100% - ${eventCenterRelativeToContainer}px)`;

        // Ajustar la posición superior de la línea futura
        timelineFuture.style.top = `${eventCenterRelativeToContainer}px`;
    }
}
