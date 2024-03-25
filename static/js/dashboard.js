// Initialize date picker
$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });
});

// Function to fetch Mill Details
function fetchMillDetails() {
    var selectedDate = $('#selectedDate').val(); // Get the selected date

    // Mapping object for subkey replacements
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

    // Perform an action with the selected date, such as sending an AJAX request
    // Example AJAX request using jQuery:
    $.ajax({
        url: '/dashboard',
        method: 'POST',
        data: {
            date: selectedDate
        },
        success: function (response) {
            // Clear existing table rows
            $('#dashboardTable tbody').empty();
            // Populate table with records
            $.each(response, function (index, record) {
                var row = '<tr>';
                // Add edit icon to s.no column
                row += '<td><button type="button" class="btn btn-link edit-btn" data-toggle="modal" data-target="#editModal">Edit</button></td>';
                // Automatically increment the S No.
                row += '<td>' + (index + 1) + '</td>';
                $.each(record, function (key, value) {
                    console.log("key", key);
                    console.log("value", value);
                    // If the column is "Defect Name", create a sub-table
                    if (key === 17) {
                        row += '<td>';
                        var defectData = JSON.parse(value);
                        // Loop through the defect data and create table rows
                        $.each(defectData, function (subkey, subvalue) {
                            // Replace subkey with corresponding value from subkeyMap
                            var replacedSubkey = subkeyMap[subkey] || subkey;
                            row += replacedSubkey + ': ' + subvalue + '<br>'; // Defect name and count
                        });
                        row += '</td>';
                    } else {
                        row += '<td>' + value + '</td>';
                    }
                });
                row += '</tr>';
                $('#dashboardTable tbody').append(row);
            });
            // Dynamically adjust cell dimensions
            adjustCellDimensions();
        },
        error: function (error) {
            console.error('Error fetching mill details:', error);
        }
    });
}

// Function to initialize the page with records for the current date
function initializeDashboard() {
    // Get the current date
    var currentDate = new Date().toISOString().slice(0, 10);
    // Set the date picker value to the current date
    $('#selectedDate').val(currentDate);
    // Fetch records for the current date
    fetchMillDetails();
}

function saveChanges() {
    // Extract the updated data from the edit modal fields
    var updatedRecord = {
        date: $('#date').val(),
        mill_name: $('#millName').val(),
        machine_brand: $('#machineBrand').val(),
        machineDia: $('#machineDia').val(),
        modelName: $('#modelName').val(),
        machineName: $('#machineName').val(),
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
        // Add other fields as needed
    };


    // Make a POST request to the update-records endpoint
    $.ajax({
        url: '/update-records',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(updatedRecord),
        success: function (response) {
            // Handle success response
            console.log('Record updated successfully:', response);
            // Optionally, you can close the edit modal or perform any other action
            $('#editModal').modal('hide');
        },
        error: function (error) {
            // Handle error response
            console.error('Error updating record:', error);
            // Optionally, display an error message to the user
            alert('Failed to update record. Please try again.');
        }
    });
}


// Call the initializeDashboard function when the page is loaded
$(document).ready(function () {
    initializeDashboard();

    // Add click event listener to edit buttons
    $('#dashboardTable').on('click', '.edit-btn', function () {
        // Open the edit modal
        $('#editModal').modal('show');
        // Perform actions to populate edit fields, if needed
    });
});

// Call the initializeDashboard function when the page is loaded
$(document).ready(function () {
    initializeDashboard();
});


$(document).ready(function () {
    initializeDashboard();

    // Add click event listener to edit buttons
    $('#dashboardTable').on('click', '.edit-btn', function () {
        // Open the edit modal
        $('#editModal').modal('show');

        // Get the row associated with the clicked edit button
        var row = $(this).closest('tr');

        // Retrieve values from the row and populate edit fields
        $('#date').val(row.find('td:eq(2)').text());
        $('#millName').val(row.find('td:eq(3)').text());
        $('#machineBrand').val(row.find('td:eq(4)').text());
        $('#machineDia').val(row.find('td:eq(5)').text());
        $('#modelName').val(row.find('td:eq(6)').text());
        $('#machineName').val(row.find('td:eq(7)').text());
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

