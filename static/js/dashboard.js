var copyvalue = [];

$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });
});

function fetchMillDetails() {
    var selectedDate = $('#selectedDate').val();

    $.ajax({
        url: '/dashboard',
        method: 'POST',
        data: {
            date: selectedDate
        },
        success: function (response) {
            var tableBody = document.getElementById('dashboardTable').getElementsByTagName('tbody')[0];
            tableBody.innerHTML = '';

            copyvalue = [];
            response.forEach(function (record, index) {
                copyvalue.push(record);
                var row = document.createElement('tr');

                var editCell = document.createElement('td');
                var editButton = document.createElement('button');
                editButton.setAttribute('type', 'button');
                editButton.classList.add('btn', 'btn-link', 'edit-btn');
                editButton.setAttribute('data-toggle', 'modal');
                editButton.setAttribute('data-target', '#editModal');
                editButton.textContent = 'Edit';
                var showDetailsButton = document.createElement('button');
                showDetailsButton.setAttribute('type', 'button');
                showDetailsButton.classList.add('btn', 'btn-link', 'show-details-btn');
                showDetailsButton.textContent = 'Show More';
                editCell.appendChild(editButton);
                editCell.appendChild(showDetailsButton);
                row.appendChild(editCell);

                var indexCell = document.createElement('td');
                indexCell.textContent = index + 1;
                row.appendChild(indexCell);

                for (var key = 0; key <= 9; key++) {
                    var cell = document.createElement('td');
                    if (record.hasOwnProperty(key)) {
                        var value = record[key];
                        if (value === null) {
                            cell.textContent = '';
                        } else if (key === 2) {
                            var roundedValue = Math.round(parseFloat(value));
                            cell.textContent = roundedValue;
                        } else if (key === 3 || key === 4 || key === 5) {
                            cell.textContent = (value === '[]') ? '' : value;
                        } else if (key === 8) {
                            if (value && value.length && value[value.length - 1] !== 'total') {
                                cell.innerHTML = generateSubTable(value);
                            }
                        } else {
                            cell.textContent = value;
                        }
                    } else {
                        cell.textContent = '';
                    }
                    row.appendChild(cell);
                }

                tableBody.appendChild(row);

            });
        },
        error: function (error) {
            console.error('Error fetching mill details:', error);
        }
    });
}

function initializeDashboard() {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayDate = yesterday.toISOString().slice(0, 10);

    $('#selectedDate').val(yesterdayDate);

    fetchMillDetails();
}

function saveChanges() {
    var selectedDate = $('#selectedDate').val();

    var updatedRecord = {
        date: selectedDate,
        mill_name: $('#millName').val(),
        machineName: $('#machineName').val(),
        avgRpm: $('#avgRpm').val(),
        guage: $('#guage').val(),
        gsm: $('#gsm').val(),
        loopLength: $('#loopLength').val(),
        uptime: $('#uptime').val(),
        noOfRevolutions: $('#noOfRevolutions').val(),
        comments: $('#comments').val(),
        machine_brand: $('#machineBrand').val(),
        machineDia: $('#machineDia').val(),
        modelName: $('#modelName').val(),
        feederType: $('#feederType').val(),
        fabricMaterial: $('#fabricMaterial').val(),
        machineRollingType: $('#machineRollingType').val(),
        status: $('#status').val(),
        internetStatus: $('#internetStatus').val(),
        totalAlarms: $('#totalAlarms').val(),
        customerComplaintsRequirements: $('#customerComplaintsRequirements').val(),
        cdcLastDone: $('#cdcLastDone').val(),
        latestAction: $('#latestAction').val()
    };

    $.ajax({
        url: '/update-records',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(updatedRecord),
        success: function (response) {
            console.log('Record updated successfully:', response);
            $('#editModal').modal('hide');
            fetchMillDetails();
        },
        error: function (error) {
            console.error('Error updating record:', error);
            alert('Failed to update record. Please try again.');
        }
    });
}

$(document).ready(function () {
    initializeDashboard();

    $('#dashboardTable').on('click', '.edit-btn', function () {
        $('#editModal').modal('show');
        var index = $(this).closest('tr').index();
        var record = copyvalue[index];
        if (record) {
            $('#millName').val(record[0]);
            $('#machineName').val(record[1]);
            $('#avgRpm').val(record[2]);
            $('#guage').val(record[3]);
            $('#gsm').val(record[4]);
            $('#loopLength').val(record[5]);
            $('#uptime').val(record[6]);
            $('#noOfRevolutions').val(record[7]);
            $('#comments').val(record[9]);
            $('#machineBrand').val(record[10]);
            $('#machineDia').val(record[11]);
            $('#modelName').val(record[12]);
            $('#feederType').val(record[13]);
            $('#fabricMaterial').val(record[14]);
            $('#machineRollingType').val(record[15]);
            $('#status').val(record[16]);
            $('#internetStatus').val(record[17]);
            $('#totalAlarms').val(record[18]);
            $('#customerComplaintsRequirements').val(record[19]);
            $('#cdcLastDone').val(record[20]);
            $('#latestAction').val(record[21]);
        } else {
            console.log("Record not found.");
        }
    });

    var keyMap = {
        '10': 'machine_brand',
        '11': 'machine_dia',
        '12': 'model_name',
        '13': 'feeder_type',
        '14': 'fabric_material',
        '15': 'machine_rolling_type',
        '16': 'status',
        '17': 'internet_status',
        '18': 'total_alarms',
        '19': 'customer_complaints_requirements',
        '20': 'cdc_last_done',
        '21': 'latest_action'
    };

    $('#dashboardTable').on('click', '.show-details-btn', function () {
        var index = $(this).closest('tr').index();
        var record = copyvalue[index];
        console.log('more details Record:', record);

        $('#moreDetailsTableBody').empty();
        for (var key = 10; key <= 21; key++) {
            var value = record[key];
            var actualKey = keyMap[key];
            var displayValue = (value === null || value.length === 0) ? 'Value not entered' : value;
            $('#moreDetailsTableBody').append('<tr><td>' + actualKey + '</td><td>' + displayValue + '</td></tr>');
        }
        $('#moreDetailsModal').modal('show');
    });
});

function generateSubTable(subTableData) {
    if (!subTableData || subTableData.length === 0) {
        return '';
    }

    var subTable = '<table class="sub-table">';
    subTable += '<thead><tr><th>Defect Name</th><th>TP</th><th>FP</th><th>NMM</th><th>MDD</th><th>ADD</th></tr></thead>';
    subTable += '<tbody>';
    subTableData.forEach(function (row) {
        subTable += '<tr>';
        row.forEach(function (cell) {
            subTable += '<td>' + cell + '</td>';
        });
        subTable += '</tr>';
    });
    subTable += '</tbody></table>';
    console.log(subTable);
    return subTable;
}
