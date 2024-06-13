var millFoldersWithRollIDs = {};
var validation_folder = "";
var alert_message = "";
var currentImageIndex = 0;
var currentImages = [];
var error_databases = [];
var validated_folder = [];
var imageStates = {};
var dateSent = false;
var currentImageUrl = "";
var currentImageCoordinates = [];
var editOptionValue = 'all_images';
var tpImages = [];
var fpImages = [];
var nmmImages = [];
var confirmationReceived = false;
// console.log("out coordinate", currentImageCoordinates);
$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    }

    );

    $(document).keydown(function (e) {
        if ($('#imageModal').is(':visible')) {
            // console.log("Key pressed:", e.key); // Check if the correct key is being detected
            if (e.key === 'a') {
                // console.log("Previous image key pressed");
                showPreviousImage(); // Check if the function is being called
            } else if (e.key === 'd') {
                // console.log("Next image key pressed");
                showNextImage(); // Check if the function is being called
            } else if (e.key === 'ArrowLeft') {
                // console.log("Arrow Left key pressed");
                setImageState('fp');
                setTimeout(showNextImage, 1000);
            } else if (e.key === 'ArrowRight') {
                // console.log("Arrow Right key pressed");
                setImageState('tp');
                setTimeout(showNextImage, 1000);
            } else if (e.key === 'ArrowUp') {
                // console.log("Arrow Up key pressed");
                setImageState('nmm');
                setTimeout(showNextImage, 1000);
            }
        }
    });

});

$(document).ready(function () {
    // Event listener for when the user changes the selection
    $('#editOptions').on('change', function () {
        editOptionValue = $(this).val();
    });
});

function showMillFolders() {
    currentImageCoordinates = [];

    $('#folderNotFound').hide();
    gosubmitBack();
    $('#millFolders').html('');
    $('#folderTitle').html('');
    var selectedDate = $('.datepicker').datepicker('getDate');
    var formattedDate = selectedDate.getFullYear() + "-" + (selectedDate.getMonth() + 1) + "-" + selectedDate.getDate();

    $('#loadingSpinner').show();

    $.ajax({
        type: "POST",
        url: "/",
        data: { date: formattedDate },
        success: function (response) {
            millFoldersWithRollIDs = response["all_mill_images"];
            // console.log("millFoldersWithRollIDs", millFoldersWithRollIDs);
            // missing_date_folders = response["missing_date_folders"];
            validation_folder = response["validation_folder"];
            alert_message = response["alert_message"];
            // error_databases = response["error_databases"];
            validated_folder = response["validated_folder"];
            // console.log("validation_folder", validation_folder);
            // console.log("millFoldersWithRollIDs", millFoldersWithRollIDs);
            if (alert_message == "false") {
                showErrorDialog("No records found for the selected date.");
                return;
            }

            updateFolderList(millFoldersWithRollIDs);

            // if (missing_date_folders.length > 0) {
            //     showMissingDateFoldersDialog(missing_date_folders);
            // }
        },
        error: function (xhr, status, error) {
            console.error(xhr.responseText);
        },
        complete: function () {
            $('#loadingSpinner').hide();
        }

    });

    dateSent = true;
}

function showErrorDialog(message) {
    bootbox.alert({
        title: "Error",
        message: message,
        backdrop: true,
        className: 'custom-dialog'
    });
}

function updateFolderList(millFoldersWithRollIDs) {
    var folderList = "<div class='folder-grid'>"; // Container for the folder grid
    var allEmpty = true; // Flag to track if all objects are empty

    // Iterate over the properties of the millFoldersWithRollIDs object
    for (var millName in millFoldersWithRollIDs) {
        if (millFoldersWithRollIDs.hasOwnProperty(millName)) {
            var millData = millFoldersWithRollIDs[millName];
            // Check if millData is not empty
            if (millData && Object.keys(millData).length > 0) {
                allEmpty = false;
                // Add folder item to the grid
                folderList += "<div class='folder-item' onclick='showImages(\"" + millName + "\", " + JSON.stringify(millData) + ")'>" +
                    "<i class='fas fa-folder folder-icon fa-5x'></i>" + // Font Awesome folder icon with increased size (fa-3x)
                    "<div class='folder-details'>" +
                    "<button class='btn btn-link folder-btn'>" + millName + "</button>" + // Folder name button
                    "</div></div>"; // End of folder item
            }
        }
    }

    if (allEmpty) {
        $('#folderNotFound').show(); // Show the message if all objects are empty
        $('#millFolders').html(''); // Clear any existing folder grid
        $('#imageDisplay').html('');
        $('#folderTitle').html('');
        return; // Exit the function
    }

    folderList += "</div>"; // End of folder grid container

    $('#millFolders').html(folderList);
    $('#folderNotFound').hide(); // Hide the message if data is found
    $('#imageDisplay').html('');
    $('#folderTitle').html('');
}


function showMissingDateFoldersDialog(missing_date_folders) {
    var dialogContent = "<div style='height: 300px; overflow-y: auto;'>";
    dialogContent += "<p>Missing Date Folders:</p><ul>";
    missing_date_folders.forEach(function (folder) {
        dialogContent += "<li>" + folder + "</li>";
    });
    dialogContent += "</ul></div>";

    bootbox.alert({
        title: "Missing Date Folders",
        message: dialogContent,
        backdrop: true,
        className: 'custom-dialog'
    });
}

function showImages(millFolder, imageData) {
    var imageList = "<div class='image-container'>";

    for (var rollNumber in imageData) {
        for (var date in imageData[rollNumber]) {
            var imagesCount = imageData[rollNumber][date].length;

            imageData[rollNumber][date].forEach(function (imageDataItem) {
                // var imageSrc = imageDataItem.image_path.replace(/\\/g, "/").startsWith("app/") ? imageDataItem.image_path.replace(/\\/g, "/").slice(4) : imageDataItem.image_path.replace(/\\/g, "/");

                console.log(imageDataItem);
                var imageSrc = "/static" + imageDataItem.image_path.replace(/\\/g, "/").slice(imageDataItem.image_path.indexOf('/temp'));
                console.log(imageSrc);
                var coordinates = imageDataItem.coordinates; // No need to parse coordinates, it's already an array

                currentImageCoordinates.push(coordinates);

                imageList += "<img src='" + imageSrc + "' alt='Image' onclick='openImageDialog(\"" + imageSrc + "\", " + JSON.stringify(coordinates) + ")'>";
            });
        }
    }

    imageList += "</div>";

    $('#editOptions, #editButton, #saveButton').hide();
    confirmationReceived = false;

    $('#imageDisplay').html(imageList);
    $('#folderTitle').html('All Images in ' + millFolder);

    $('#millFolders').hide();
    $('#backButton').removeClass('d-none');
    $('#submitBtn').removeClass('d-none');
    $('#startSubtractionBtn').removeClass('d-none');
}


function goBack() {
    $('#millFolders').show();
    $('#backButton').addClass('d-none');

    $('#imageDisplay').html('');
    $('#folderTitle').html('');
}

function submitImages() {
    var anyImageSelected = Object.values(imageStates).some(function (state) {
        return state !== undefined;
    });

    var allImagesMarked = currentImages.every(function (imageUrl) {
        return imageStates[imageUrl] !== undefined;
    });

    if (!anyImageSelected) {
        showErrorDialog("No images are selected for submission.");
        return;
    }

    if (!allImagesMarked) {
        showErrorDialog("You must mark all images before submission.");
        return;
    }

    bootbox.confirm({
        message: "Do you want to save these subtracted images?",
        buttons: {
            confirm: {
                label: 'Yes',
                className: 'btn-primary'
            },
            cancel: {
                label: 'No',
                className: 'btn-secondary'
            }
        },
        callback: function (result) {
            if (result) {
                showSecondaryDialog();

                // Show the edit options, edit button, and save button
                // $('#editOptions, #editButton, #saveButton').show();

                // // Set the confirmationReceived flag to true
                // confirmationReceived = true;

                // // You may want to trigger the 'click' event of the first image here
                // var firstImageUrl = currentImages[0];
                // var coordinates = currentImageCoordinates[0];
                // showSeparateTpFpNmmImages();
                // openImageDialog(firstImageUrl, coordinates);
            } else {
                bootbox.hideAll();

                // Hide the edit options, edit button, and save button if "No" is clicked
                // $('#editOptions, #editButton, #saveButton').hide();
                // showSecondaryDialog();
            }
        }
    });
}

function showQualityCheckingFrame() {
    $('#qualityCheckingFrame').removeClass('d-none');
    $('#backButtonQuaty').removeClass('d-none');
    $('#qualityCheckingHeading').removeClass('d-none');
    $('#saveButton').removeClass('d-none');
    showSeparateTpFpNmmImages();
}

function showSecondaryDialog() {
    var tpCount = Object.values(imageStates).filter(function (state) {
        return state === 'tp';
    }).length;
    var fpCount = Object.values(imageStates).filter(function (state) {
        return state === 'fp';
    }).length;
    var nmmCount = Object.values(imageStates).filter(function (state) {
        return state === 'nmm';
    }).length;

    var message = "Total TP count: " + tpCount + "<br>" +
        "Total FP count: " + fpCount + "<br>" +
        "Total NMM count: " + nmmCount + "<br>" +
        "<input type='text' id='comment' placeholder='Enter your comment...' class='form-control mt-3'>";

    bootbox.dialog({
        title: "Secondary Dialog",
        message: message,
        buttons: {
            submit: {
                label: "Submit",
                className: "btn-primary",
                callback: function () {
                    var comment = $('#comment').val();
                    proceedWithSubmission();
                    $('#imageModal').modal('hide'); // Close the image viewer dialog

                }
            }
        }
    });
}

function proceedWithSubmission() {
    var submissionData = [];
    var totalTPCount = 0;
    var totalFPCount = 0;
    var totalNMMCount = 0;
    var comment = $('#comment').val();
    var validated = "validated"; // Add the validated variable and assign the value "validated"

    // Initialize count details object
    var countDetails = {};

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];
        if (state !== undefined) {
            console.log(imageUrl);
            var millName = getMillNameFromUrl(imageUrl);
            var unitName = getMillUnitNameFromUrl(imageUrl);
            var addname = getAddFromUrl(imageUrl);
            var machineName = getMillMachineNameFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);
            var cameraName = getCameraNameFromUrl(imageUrl);
            var label = getLabelFromUrl(imageUrl);

            var folderPath = validation_folder + millName + "/" + unitName + "/" + addname + "/" + machineName + "/" + rollNumber + "/" + date + "/" + cameraName + "/" + label + "/" + state;
            console.log("Mill Name:", millName);
            console.log("Unit Name:", unitName);
            console.log("Add Name:", addname);
            console.log("Machine Name:", machineName);
            console.log("Roll Number:", rollNumber); // Should print "46"
            console.log("Date:", date); // Should print "2024-05-29"
            console.log("Camera Name:", cameraName); // Should print the camera name
            console.log("Label:", label);
            console.log("Folder Path:", folderPath);
            var imageData = {
                source: imageUrl,
                destination: folderPath,
                mill_name: millName,
                machine_name: machineName,
                date: date,
                count_details: [], // Initialize count details array
                comment: comment,
                validated: validated // Assign the validated variable to each imageData object
            };

            // Update count details
            if (!countDetails[label]) {
                countDetails[label] = { label: label, tp: 0, fp: 0, nmm: 0 };
            }

            if (state === 'tp') {
                totalTPCount++;
                countDetails[label].tp++;
            } else if (state === 'fp') {
                totalFPCount++;
                countDetails[label].fp++;
            } else if (state === 'nmm') {
                totalNMMCount++;
                countDetails[label].nmm++;
            }

            submissionData.push(imageData);
        }
    });

    // Create count details array from the countDetails object
    var countDetailsArray = Object.values(countDetails);
    // Add total count to countDetails object
    countDetailsArray.push({
        total: {
            total_tp_count: totalTPCount,
            total_fp_count: totalFPCount,
            total_nmm_count: totalNMMCount
        }
    });

    submissionData.forEach(function (imageData) {
        // Assign count details array to imageData object
        imageData.count_details = countDetailsArray;
    });

    submissionData.forEach(function (imageData) {
        console.log(imageData);
        $.ajax({
            type: "POST",
            url: "/move-image",
            data: JSON.stringify(imageData), // Serialize the object
            processData: false,
            contentType: 'application/json', // Set content type to JSON
            success: function (response) {
                console.log(response);
            },
            error: function (xhr, status, error) {
                console.error(xhr.responseText);
            }
        });

    });

    gosubmitBack();
}

function getLabelFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 11) {
        return parts[11];
    }
    return null;
}


function getMillNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 3) {
        return parts[3];
    }
    return null;
}

function getMillUnitNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 4) {
        return parts[4];
    }
    return null;
}

function getAddFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 5) {
        return parts[5];
    }
    return null;
}
function getMillMachineNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 6) {
        return parts[6];
    }
    return null;
}

function getImageLabelFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 2) {
        return parts[parts.length - 2];
    }
    return null;
}

function getRollNumberFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 7) {
        return parts[7];
    }
    return null;
}

function getDateFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 8) { // Ensure there are enough parts to access the 7th index
        return parts[8];
    }
    return null;
}

function getCameraNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 9) { // Ensure there are enough parts to access the 7th index
        return parts[9];
    }
    return null;
}

function updateSelectedImageBorder() {
    var currentImageUrl = currentImages[currentImageIndex];
    updateImageBorder(currentImageUrl, imageStates[currentImageUrl]);
}

function showNextImage() {
    if (currentImageIndex < currentImages.length - 1) {
        currentImageIndex++;
        var imageUrl = currentImages[currentImageIndex];
        var coordinates = currentImageCoordinates[currentImageIndex]; // Get coordinates for the next image

        if (coordinates !== undefined) {
            openImageDialog(imageUrl, coordinates);
            drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the new image
            updateSelectedImageBorder();
        } else {
            console.error("Coordinates for the next image are undefined.");
        }
    }
}

function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        var imageUrl = currentImages[currentImageIndex];
        var coordinates = currentImageCoordinates[currentImageIndex]; // Get coordinates for the previous image

        openImageDialog(imageUrl, coordinates);
        drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the new image
        updateSelectedImageBorder();
    }
}

function setImageState(state) {
    var currentImageUrl = currentImages[currentImageIndex];
    imageStates[currentImageUrl] = state;

    updateImageBorder(currentImageUrl, state);
    updateStatus(state);

    var anyImageSelected = Object.values(imageStates).some(function (state) {
        return state !== undefined;
    });

    if (anyImageSelected) {
        $('#submitBtn').show();
    } else {
        $('#submitBtn').hide();
    }

    updateSelectedImageBorder();
}

function updateStatus(state) {
    var statusText = '';

    switch (state) {
        case 'tp':
            statusText = 'True Positive';
            break;
        case 'fp':
            statusText = 'False Positive';
            break;
        case 'nmm':
            statusText = 'Name Mismatch';
            break;
        default:
            statusText = '';
    }

    $('#status').text(statusText);
}

function updateImageBorder(imageUrl, state) {
    var $image = $('[src="' + imageUrl + '"]');
    var borderColor = '';

    switch (state) {
        case 'tp':
            borderColor = 'green';
            break;
        case 'fp':
            borderColor = 'red';
            break;
        case 'nmm':
            borderColor = 'blue';
            break;
        default:
            borderColor = 'none';
    }

    $image.css({
        'border': borderColor !== 'none' ? '4px solid ' + borderColor : 'none',
        'margin': '5px'
    });
}

function goBack() {
    bootbox.confirm({
        message: "Are you sure you want to go back?",
        buttons: {
            confirm: {
                label: 'Yes',
                className: 'btn-primary'
            },
            cancel: {
                label: 'No',
                className: 'btn-secondary'
            }
        },
        callback: function (result) {
            if (result) {
                $('#millFolders').show();
                $('#backButton').addClass('d-none');
                $('#imageDisplay').html('');
                $('#folderTitle').html('');
                $('#submitBtn').addClass('d-none');

                $('#startSubtractionBtn').addClass('d-none');

                currentImages = [];
                imageStates = {};
                currentImageCoordinates = [];

            }
        }
    });
}

function gosubmitBack() {
    $('#millFolders').show();
    $('#backButton').addClass('d-none');
    $('#imageDisplay').html('');
    $('#folderTitle').html('');
    $('#submitBtn').addClass('d-none');
    $('#startSubtractionBtn').addClass('d-none');

    currentImages = [];
    imageStates = {};
    currentImageCoordinates = [];
}



function hideQualityCheckingFrame() {
    $('#qualityCheckingFrame').addClass('d-none');
    $('#backButton').removeClass('d-none');

    currentImages.forEach(function (imageUrl) {
        updateImageBorder(imageUrl, imageStates[imageUrl]);
    });
}

function drawRectanglePlot(imageUrl, coordinates) {
    // console.log("draw ", coordinates);

    // Create a new image element
    var img = new Image();

    // Set the image source to the provided URL
    img.src = imageUrl;

    // Wait for the image to load
    img.onload = function () {
        // Get the existing canvas element
        var canvas = document.getElementById('imageCanvas');
        var ctx = canvas.getContext('2d');

        // Set canvas dimensions to match image dimensions
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image on the canvas
        ctx.drawImage(img, 0, 0);

        // Parse coordinates
        var x1 = coordinates[0][0]; // x coordinate of the first point
        var y1 = coordinates[0][1]; // y coordinate of the first point
        var x2 = coordinates[1][0]; // x coordinate of the second point
        var y2 = coordinates[1][1]; // y coordinate of the second point

        // Calculate rectangle dimensions
        var width = x2 - x1;
        var height = y2 - y1;

        // Draw rectangle on the canvas
        ctx.beginPath();
        ctx.rect(x1, y1, width, height);

        // Set border color to white
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.closePath();
    };
}


function startSubtraction() {
    // Check if there are images available
    if (currentImageCoordinates.length > 0) {
        confirmationReceived = false;
        $('#editOptions, #editButton, #saveButton').hide();

        // Retrieve the URL and coordinates of the first image
        var firstImageUrl = $('#imageDisplay img:first').attr('src');
        var firstImageCoordinates = currentImageCoordinates[0];

        // Call the openImageDialog function with the URL and coordinates of the first image
        openImageDialog(firstImageUrl, firstImageCoordinates);
    } else {
        // Handle case where there are no images available
        console.error("No images available for subtraction.");
        // You can display an error message or take appropriate action here
    }
}

// =========================================

function showSeparateTpFpNmmImages() {
    var tpImages = [];
    var fpImages = [];
    var nmmImages = [];
    var tpImageCoordinates = [];
    var fpImageCoordinates = [];
    var nmmImageCoordinates = [];

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];
        var coordinates = currentImageCoordinates[currentImages.indexOf(imageUrl)];

        if (state === 'tp') {
            tpImages.push(imageUrl);
            tpImageCoordinates.push(coordinates);
        } else if (state === 'fp') {
            fpImages.push(imageUrl);
            fpImageCoordinates.push(coordinates);
        } else if (state === 'nmm') {
            nmmImages.push(imageUrl);
            nmmImageCoordinates.push(coordinates);
        }
    });

    var result = {
        tpImages: { images: tpImages, coordinates: tpImageCoordinates },
        fpImages: { images: fpImages, coordinates: fpImageCoordinates },
        nmmImages: { images: nmmImages, coordinates: nmmImageCoordinates },
        allImages: { images: currentImages, coordinates: currentImageCoordinates }
    };

    // Send the result to the Flask server
    $.ajax({
        type: "POST",
        url: "/filter_option",
        contentType: "application/json",
        data: JSON.stringify(result),
        success: function (response) {
            console.log("Data sent successfully!");
        },
        error: function (xhr, status, error) {
            console.error("Error sending data:", error);
        }
    });
}


function openImageDialog(imageUrl, coordinates) {
    $('#editOptions, #editButton, #saveButton').hide();

    var parts = imageUrl.split('/');
    // console.log("imageUrl",  imageUrl);
    var label = parts[parts.length - 2];

    $('#imageLabel').text("Label: " + label);
    drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the selected image
    $('#imageCanvas').attr('src', imageUrl);
    $('#imageModal').modal('show');
    console.log("++++++++++++++++++++++");
    console.log("editOptionValue", editOptionValue);
    console.log("++++++++++++++++++++++");

    if (confirmationReceived) {
        $('#editOptions, #editButton, #saveButton').show();

        var handleResponse = function (response) {
            // Handle response differently when confirmation is true
            if (editOptionValue === 'false_positive') {
                currentImages = response.false_positive_image;
                console.log("currentImages", currentImages);
            } else if (editOptionValue === 'true_positive') {
                currentImages = response.true_positive_image.images;
                currentImageCoordinates = response.true_positive_image.coordinates;
            } else if (editOptionValue === 'name_mismatch') {
                currentImages = response.name_mismatch_image.images;
                currentImageCoordinates = response.name_mismatch_image.coordinates;
            } else {
                currentImages = $('#imageDisplay').find('img').map(function () {
                    return $(this).attr('src');
                }).get();
            }


            currentImageIndex = currentImages.indexOf(imageUrl);
            updateStatus(imageStates[imageUrl]);
            updateImageBorder(imageUrl);
            $('#imageCount').text((currentImageIndex + 1) + "/" + currentImages.length);
            updateSelectedImageBorder();
        };
        // Send the selected option value to the server with the callback function
        sendOptionValueToServer(editOptionValue, handleResponse);

    } else {
        $('#editOptions, #editButton, #saveButton').hide();

        // Handle response differently when confirmation is false
        currentImages = $('#imageDisplay').find('img').map(function () {
            return $(this).attr('src');
        }).get();

        currentImageIndex = currentImages.indexOf(imageUrl);
        updateStatus(imageStates[imageUrl]);
        updateImageBorder(imageUrl);
        $('#imageCount').text((currentImageIndex + 1) + "/" + currentImages.length);
        updateSelectedImageBorder();
    }
    //  confirmationReceived = false;

}

function sendOptionValueToServer(optionValue, callback) {
    $.ajax({
        type: "POST",
        url: "/return_option_value",
        contentType: "application/json",
        data: JSON.stringify({ option: optionValue }),
        success: function (response) {
            // Handle the response from the server
            console.log("Response from server:", response);
            // Pass the updated currentImages to the callback function
            callback(response);
        },
        error: function (xhr, status, error) {
            console.error("Error sending selected option to server:", error);
        }
    });
}