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
console.log("out coordinate", currentImageCoordinates);
$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });

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

function showMillFolders() {
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
            missing_date_folders = response["missing_date_folders"];
            validation_folder = response["validation_folder"];
            alert_message = response["alert_message"];
            error_databases = response["error_databases"];
            validated_folder = response["validated_folder"];
            // console.log("validation_folder", validation_folder);
            // console.log("millFoldersWithRollIDs", millFoldersWithRollIDs);
            if (alert_message == "false") {
                showErrorDialog("No records found for the selected date.");
                return;
            }

            updateFolderList(millFoldersWithRollIDs);

            if (missing_date_folders.length > 0) {
                showMissingDateFoldersDialog(missing_date_folders);
            }
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
    var folderList = "<ul style='padding: 20px;'>";
    millFoldersWithRollIDs.forEach(function (millData) {
        for (var millName in millData) {
            var validated = validated_folder[millName];
            var validateIcon = (validated === 'validated') ? "<i class='fas fa-check-circle'></i>" : "";
            folderList += "<li><img src='static/assets/icons8-folder-48.png' class='folder-icon' />" +
                "<button class='btn btn-link folder-btn' onclick='showImages(\"" + millName + "\", " + JSON.stringify(millData[millName]) + ")'>" +
                millName + "</button>" + validateIcon + "</li>";
        }
    });
    folderList += "</ul>";

    $('#millFolders').html(folderList);
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
                // console.log("imageDataItem", imageDataItem);
                var imageSrc = imageDataItem.image_path.replace(/\\/g, "/");
                var coordinates = JSON.parse(imageDataItem.coordinates);
                // console.log("sho image coordinage", coordinates);
                currentImageCoordinates.push(coordinates);
                imageList += "<img src='" + imageSrc + "' alt='Image' onclick='openImageDialog(\"" + imageSrc + "\", " + JSON.stringify(coordinates) + ")'>";
            });
        }
    }

    imageList += "</div>";

    $('#imageDisplay').html(imageList);
    $('#folderTitle').html('All Images in ' + millFolder);

    $('#millFolders').hide();
    $('#backButton').removeClass('d-none');
    $('#submitBtn').removeClass('d-none');
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
                // Set the confirmationReceived flag to true
                confirmationReceived = true;

                // Show both the edit button and edit options
                $('#editButton').show();
                $('#editOptions').show();

                // You may want to trigger the 'click' event of the first image here
                var firstImageUrl = currentImages[0];
                openImageDialog(firstImageUrl);
            } else {
                showSecondaryDialog();
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
            var millName = getMillNameFromUrl(imageUrl);
            var machineName = getMillMachineNameFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);
            var label = getLabelFromUrl(imageUrl);

            var folderPath = validation_folder + millName + "/" + machineName + "/" + rollNumber + "/" + date + "/" + state;
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
    if (parts.length >= 2) {
        return parts[parts.length - 2];
    }
    return null;
}


function showSeparateTpFpNmmImages() {
    var tpImages = [];
    var fpImages = [];
    var nmmImages = [];

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];

        if (state === 'tp') {
            tpImages.push(imageUrl);
        } else if (state === 'fp') {
            fpImages.push(imageUrl);
        } else if (state === 'nmm') {
            nmmImages.push(imageUrl);
        }
    });

    var result = {
        tpImages: tpImages,
        fpImages: fpImages,
        nmmImages: nmmImages
    };
    // console.log(result);

    return result;
}


function showImagesSeparately(category, images) {
    var imageList = "<div class='image-container' style='display: flex; flex-wrap: wrap; justify-content: start;'>";

    images.forEach(function (imageUrl) {
        imageList += "<img src='" + imageUrl + "' alt='Image' style='width: 200px; height: auto; margin: 10px;'>";
    });
    imageList += "</div>";

    $('#qualityCheckingFrame').append("<h3 style='text-align: left;'>" + category + "</h3>");
    $('#qualityCheckingFrame').append(imageList);

}

function getMillNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 2) {
        return parts[2];
    }
    return null;
}

function getMillMachineNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 3) {
        return parts[3];
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

function openImageDialog(imageUrl, coordinates) {
    console.log("openimaegdialog coordiante", coordinates);
    var parts = imageUrl.split('/');
    var label = parts[parts.length - 2];
    var editOptionValue = $('#editOptions').val();

    $('#imageLabel').text("Label: " + label);
    drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the selected image
    $('#imageFrame').attr('src', imageUrl);
    $('#imageModal').modal('show');

    // Update current image URL and coordinates based on the selected image
    currentImageUrl = imageUrl;
    // currentImageCoordinates.push(coordinates);    // Call showSeparateTpFpNmmImages function to get the images
    var images = showSeparateTpFpNmmImages();
    var tpImages = images.tpImages; // Access tpImages property
    var fpImages = images.fpImages; // Access fpImages property
    var nmmImages = images.nmmImages; // Access nmmImages property

    // Check the selected edit option and display images accordingly
    if (editOptionValue === 'all_images') {
        currentImages = $('#imageDisplay').find('img').map(function () {
            return $(this).attr('src');
        }).get();
        // currentImageUrl.push(currentImageUrl);
        // console.log("all", currentImages);
        // Use the edit option value as needed
        // console.log("Selected edit option:", editOptionValue);
    } else if (editOptionValue === 'false_positive') {
        currentImages = fpImages;
        // console.log("fp", currentImages);
        // // Use the edit option value as needed
        // console.log("Selected edit option:", editOptionValue);
    } else if (editOptionValue === 'true_positive') {
        currentImages = tpImages;
        // console.log("tp", currentImages);
        // // Use the edit option value as needed
        // console.log("Selected edit option:", editOptionValue);
    } else if (editOptionValue === 'name_mismatch') {
        currentImages = nmmImages;
        // console.log("nmm", currentImages);
        // // Use the edit option value as needed
        // console.log("Selected edit option:", editOptionValue);
    }

    // Update current image index and display the selected image
    currentImageIndex = currentImages.indexOf(imageUrl);
    updateStatus(imageStates[imageUrl]);
    updateImageBorder(imageUrl);
    $('#imageCount').text((currentImageIndex + 1) + "/" + currentImages.length);
    updateSelectedImageBorder();


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

                currentImages = [];
                imageStates = {};
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

    currentImages = [];
    imageStates = {};
}

function getRollNumberFromUrl(imageUrl) {
    var regex = /\/(\d+)\/\d{4}-\d{2}-\d{2}\//;
    var match = imageUrl.match(regex);
    if (match && match.length > 1) {
        return match[1];
    }
    return null;
}

function getDateFromUrl(imageUrl) {
    var regex = /\d{4}-\d{2}-\d{2}/;
    var match = imageUrl.match(regex);
    if (match && match.length > 0) {
        return match[0];
    }
    return null;
}

function hideQualityCheckingFrame() {
    $('#qualityCheckingFrame').addClass('d-none');
    $('#backButton').removeClass('d-none');

    currentImages.forEach(function (imageUrl) {
        updateImageBorder(imageUrl, imageStates[imageUrl]);
    });
}

function drawRectanglePlot(imageUrl, coordinates) {
    console.log("draw ", coordinates);
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
        var parsedCoordinates = coordinates.map(parseFloat);

        // Calculate rectangle dimensions
        var x1 = parsedCoordinates[0];
        var y1 = parsedCoordinates[1];
        var x2 = parsedCoordinates[2];
        var y2 = parsedCoordinates[3];
        var width = x2 - x1;
        var height = y2 - y1;

        // Draw rectangle on the canvas
        ctx.beginPath();
        ctx.rect(x1, y1, width, height);

        // Set border color to white
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.closePath();
    };
}



