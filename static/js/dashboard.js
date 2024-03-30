$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });
});

function fetchMillDetails() {
    var selectedDate = $('#selectedDate').val();

    var subkeyMap = {
        '1': 'lycra',
        '2': 'hole',
        '3': 'shutoff',
        '4': 'needln',
        '5': 'oil',
        '6': 'twoply',
        '7': 'stopline',
        '8': 'countmix',
        '9': 'two_ply'
    };

    $.ajax({
        url: '/dashboard',
        method: 'POST',
        data: {
            date: selectedDate
        },
        success: function (response) {
            $('#dashboardTable tbody').empty();
            $.each(response, function (index, record) {
                var row = '<tr>';
                row += '<td><button type="button" class="btn btn-link edit-btn" data-toggle="modal" data-target="#editModal">Edit</button></td>';
                row += '<td>' + (index + 1) + '</td>';
                $.each(record, function (key, value) {
                    if (key === 17) {
                        row += '<td>';
                        var defectData = JSON.parse(value);
                        $.each(defectData, function (subkey, subvalue) {
                            var replacedSubkey = subkeyMap[subkey] || subkey;
                            row += replacedSubkey + ': ' + subvalue + '<br>';
                        });
                        row += '</td>';
                    } else {
                        row += '<td>' + value + '</td>';
                    }
                });
                row += '</tr>';
                $('#dashboardTable tbody').append(row);
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
    var updatedRecord = {
        date: $('#date').val(),
        mill_name: $('#millName').val(),
        machineName: $('#machineName').val(),
        machine_brand: $('#machineBrand').val(),
        machineDia: $('#machineDia').val(),
        modelName: $('#modelName').val(),
        avgRpm: $('#avgRpm').val(),
        feederType: $('#feederType').val(),
        gauge: $('#gauge').val(),
        gsm: $('#gsm').val(),
        loopLength: $('#loopLength').val(),
        fabricMaterial: $('#fabricMaterial').val(),
        machineRollingType: $('#machineRollingType').val(),
        status: $('#status').val(),
        internetStatus: $('#internetStatus').val(),
        uptime: $('#uptime').val(),
        noOfRevolutions: $('#noOfRevolutions').val(),
        defectName: $('#defectName').val(),
        totalAlarms: $('#totalAlarms').val(),
        truePositive: $('#truePositive').val(),
        nameMismatch: $('#nameMismatch').val(),
        falsePositive: $('#falsePositive').val(),
        fabricParameters: $('#fabricParameters').val(),
        comments: $('#comments').val(),
        customerComplaints: $('#customerComplaints').val(),
        cdc: $('#cdc').val(),
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
        },
        error: function (error) {
            console.error('Error updating record:', error);
            alert('Failed to update record. Please try again.');
        }
    });
    fetchMillDetails();
}

$(document).ready(function () {
    initializeDashboard();

    $('#dashboardTable').on('click', '.edit-btn', function () {
        $('#editModal').modal('show');
    });
});

$(document).ready(function () {
    initializeDashboard();

    $('#dashboardTable').on('click', '.edit-btn', function () {
        $('#editModal').modal('show');

        var row = $(this).closest('tr');

        $('#date').val(row.find('td:eq(2)').text());
        $('#millName').val(row.find('td:eq(3)').text());
        $('#machineName').val(row.find('td:eq(4)').text());
        $('#machineBrand').val(row.find('td:eq(5)').text());
        $('#machineDia').val(row.find('td:eq(6)').text());
        $('#modelName').val(row.find('td:eq(7)').text());
        $('#avgRpm').val(row.find('td:eq(8)').text());
        $('#feederType').val(row.find('td:eq(9)').text());
        $('#gauge').val(row.find('td:eq(10)').text());
        $('#gsm').val(row.find('td:eq(11)').text());
        $('#loopLength').val(row.find('td:eq(12)').text());
        $('#fabricMaterial').val(row.find('td:eq(13)').text());
        $('#machineRollingType').val(row.find('td:eq(14)').text());
        $('#status').val(row.find('td:eq(15)').text());
        $('#internetStatus').val(row.find('td:eq(16)').text());
        $('#uptime').val(row.find('td:eq(17)').text());
        $('#noOfRevolutions').val(row.find('td:eq(18)').text());
        $('#defectName').val(row.find('td:eq(19)').text());
        $('#totalAlarms').val(row.find('td:eq(20)').text());
        $('#truePositive').val(row.find('td:eq(21)').text());
        $('#nameMismatch').val(row.find('td:eq(22)').text());
        $('#falsePositive').val(row.find('td:eq(23)').text());
        $('#fabricParameters').val(row.find('td:eq(24)').text());
        $('#comments').val(row.find('td:eq(25)').text());
        $('#customerComplaints').val(row.find('td:eq(26)').text());
        $('#cdc').val(row.find('td:eq(27)').text());
        $('#latestAction').val(row.find('td:eq(28)').text());
    });
});

$(document).ready(function () {
    initializeDashboard();
});
