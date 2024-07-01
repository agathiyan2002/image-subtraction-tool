function renderChart(data, key, label, chartId, color) {
    const timestamps = data.map(entry => new Date(entry.timestamp).getTime());
    const values = data.map(entry => entry[key]);

    const series = timestamps.map((timestamp, index) => ({
        x: timestamp,
        y: values[index]
    }));

    const options = {
        chart: {
            type: 'area', // Changed to 'area' chart
            height: 150,
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: {
                    speed: 1000
                }
            }
        },
        series: [{
            name: label,
            data: series
        }],
        xaxis: {
            type: 'datetime',
            labels: {
                formatter: function (value) {
                    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
        },
        yaxis: {
            title: {
                text: label
            }
        },
        dataLabels: {
            enabled: false
        },
        colors: [color]
    };

    if (timestamps.length > 0) {
        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);

        // Calculate the visible range based on data range
        const dateRange = maxTimestamp - minTimestamp;
        const maxVisibleRange = 3600000 * 24 * 2; // Maximum visible range: 2 days in milliseconds

        // Set the visible range to the data range if it's smaller than the maximum visible range
        const visibleRange = Math.min(dateRange, maxVisibleRange);
        const initialViewStart = maxTimestamp - visibleRange;

        options.xaxis.min = initialViewStart;
        options.xaxis.max = maxTimestamp;
    }

    const chart = new ApexCharts(document.getElementById(chartId), options);
    chart.render();
    // Show the chart container after rendering the chart
    document.getElementById(chartId).parentNode.style.display = 'block';
}


function renderScatterChart(containerId, barchart, uptimeStatusChart, camstatus) {
    // Extract timestamps and status from the barchart data
    const timestamps = barchart.map(entry => new Date(entry.timestamp));
    const statusValues = barchart.map(entry => entry.status);

    // Map the data to the format required by ApexCharts
    const seriesData = timestamps.map((timestamp, index) => {
        return {
            x: timestamp,
            y: statusValues[index] === 1 ? 15 : 14,
            fillColor: statusValues[index] === 1 ? '#008000' : '#FF0000' // Green for status 1, Red for status 0
        };
    });

    // Process uptimeStatusChart data and add additional statuses
    const uptimeStatuses = ['Software Status', 'Kniting Machine Status', 'Controller Status', 'ML Status', 'Redis Status', 'Report Status', 'UI Status', 'Monitor Status', 'Alarm Status'];
    const uptimeStatusValues = {
        'Software Status': { yValue: 13, fillColor: '#FFA500' }, // Orange for Software Status 0
        'Kniting Machine Status': { yValue: 6, fillColor: '#800080' }, // Purple for Kniting Machine Status 0
        'Controller Status': { yValue: 7, fillColor: '#FF00FF' }, // Magenta for Controller Status 0
        'ML Status': { yValue: 4, fillColor: '#00FFFF' }, // Cyan for ML Status 0
        'Redis Status': { yValue: 1, fillColor: '#0000FF' }, // Blue for Redis Status 0
        'Report Status': { yValue: 8, fillColor: '#FF00FF' }, // Magenta for Report Status 0
        'UI Status': { yValue: 2, fillColor: '#800000' }, // Maroon for UI Status 0
        'Monitor Status': { yValue: 3, fillColor: '#808000' }, // Olive for Monitor Status 0
        'Alarm Status': { yValue: 5, fillColor: '#FF00FF' } // Magenta for Alarm Status 0
    };

    const presentStatuses = new Set();

    uptimeStatusChart.forEach(entry => {
        uptimeStatuses.forEach(status => {
            if (entry[status] === '0') {
                seriesData.push({
                    x: new Date(entry.Timestamp),
                    y: uptimeStatusValues[status].yValue,
                    fillColor: uptimeStatusValues[status].fillColor
                });
                presentStatuses.add(uptimeStatusValues[status].yValue);
            }
        });
    });

    console.log('camstatus data:', camstatus);

    // Process camstatus data
    camstatus.forEach(entry => {
        const timestamp = new Date(entry.timestamp);

        const camStatusKeys = {
            'greencam1_status': { yValue: 12, fillColor: '#0000FF' },
            'greencam2_status': { yValue: 11, fillColor: '#00FF00' },
            'blackcam-wireless_status': { yValue: 10, fillColor: '#FF00FF' },
            'blackcam-wired_status': { yValue: 9, fillColor: '#800080' },
            'voltcam_status': { yValue: 8, fillColor: '#FFFF00' }
        };

        for (const [key, { yValue, fillColor }] of Object.entries(camStatusKeys)) {
            if (entry[key] && entry[key] === '2') {
                console.log(`Adding cam status: ${key} at ${timestamp}`);
                seriesData.push({
                    x: timestamp,
                    y: yValue,
                    fillColor: fillColor
                });
                presentStatuses.add(yValue);
            }
        }
    });

    // Define dynamic Y-axis labels
    const yAxisLabels = {
        1: 'Redis Status',
        2: 'UI Status',
        3: 'Monitor Status',
        4: 'ML Status',
        5: 'Alarm Status',
        6: 'Kniting Machine Status',
        7: 'Controller Status',
        8: 'voltcam_status',
        9: 'blackcam-wired_status',
        10: 'blackcam-wireless_status',
        11: 'greencam2_status',
        12: 'greencam1_status',
        13: 'Software Status off',
        14: 'knit-i off status',
        15: 'knit-i on status'
    };

    // Filter out labels that are not present in the data
    const filteredLabels = Object.keys(yAxisLabels)
        .filter(key => presentStatuses.has(parseInt(key)) || [13, 14, 15].includes(parseInt(key)))
        .reduce((obj, key) => {
            obj[key] = yAxisLabels[key];
            return obj;
        }, {});

    // Chart options
    const options = {
        chart: {
            type: 'scatter',
            height: 800
        },
        series: [{
            name: 'Scatter Series',
            data: seriesData
        }],
        xaxis: {
            type: 'datetime',
            labels: {
                rotate: -45,
                formatter: function (val) {
                    const date = new Date(val);
                    const hours = date.getHours();
                    const minutes = date.getMinutes();
                    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
                }
            }
        },
        yaxis: {
            title: {
                text: 'Values'
            },
            labels: {
                formatter: function (val) {
                    return filteredLabels[val] || '';
                }
            },
            tickAmount: Object.keys(filteredLabels).length,
            min: Math.min(...Object.keys(filteredLabels).map(Number)) - 1,
            max: 15
        },
        title: {
            text: 'Scatter Chart',
            align: 'left'
        },
        tooltip: {
            x: {
                formatter: function (val) {
                    const date = new Date(val);
                    const hours = date.getHours();
                    const minutes = date.getMinutes();
                    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
                }
            },
            y: {
                formatter: function (val) {
                    return filteredLabels[val] || val;
                }
            }
        }
    };

    // Render the chart
    const chart = new ApexCharts(document.getElementById(containerId), options);
    chart.render();
}





document.getElementById('dateForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const startDate = document.getElementById('start_date').value;
    const endDate = document.getElementById('end_date').value;

    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'flex';

    // Fetch data after showing the headings
    fetch('/uptime', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `start_date=${startDate}&end_date=${endDate}`
    })
        .then(response => response.json())
        .then(data => {
            document.querySelector('.row').style.display = 'flex';

            var linechart = data["linechart"];
            var barchart = data["barchart"];
            var uptimeStatusChart = data["uptime"]; // Assuming this is the key for uptime_status chart data
            var camstatus = data["camstatus"];
            // console.log(camstatus);
            // Clear previous charts
            clearCharts();

            // Render each chart after fetching the data with updated colors
            renderChart(linechart, 'temperature', 'Temperature', 'temperatureChart', '#FF5733');
            renderChart(linechart, 'cpu', 'CPU', 'cpuChart', '#1F77B4');
            renderChart(linechart, 'gpu', 'GPU', 'gpuChart', '#2CA02C');
            renderChart(linechart, 'memory', 'Memory', 'memoryChart', '#FF7F0E');

            renderScatterChart('scatterChart', barchart, uptimeStatusChart, camstatus);



            // Hide loading indicator
            document.getElementById('loadingIndicator').style.display = 'none';
        });
});


// Function to clear all charts
function clearCharts() {
    const chartIds = ['temperatureChart', 'cpuChart', 'gpuChart', 'memoryChart', 'scatterChart'];

    chartIds.forEach(id => {
        document.getElementById(id).innerHTML = ''; // Clear the inner HTML of each chart container
    });
}

