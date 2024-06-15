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
$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });

    $(document).keydown(function (e) {
        if ($('#imageModal').is(':visible')) {
            if (e.key === 'a') {
                showPreviousImage();
            } else if (e.key === 'd') {
                showNextImage();
            } else if (e.key === 'ArrowLeft') {
                setImageState('fp');
                setTimeout(showNextImage, 1000);
            } else if (e.key === 'ArrowRight') {
                setImageState('tp');
                setTimeout(showNextImage, 1000);
            } else if (e.key === 'ArrowUp') {
                setImageState('nmm');
                setTimeout(showNextImage, 1000);
            }
        }
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
            validation_folder = response["validation_folder"];
            alert_message = response["alert_message"];
            validated_folder = response["validated_folder"];
            if (alert_message == "false") {
                showErrorDialog("No records found for the selected date.");
                return;
            }

            updateFolderList(millFoldersWithRollIDs);
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
    var folderList = "<div class='folder-grid'>";
    var allEmpty = true;

    for (var millName in millFoldersWithRollIDs) {
        var validated = validated_folder[millName];
        var validateIcon = (validated === 'validated') ? "<i class='fas fa-check-circle'></i>" : "";

        if (millFoldersWithRollIDs.hasOwnProperty(millName)) {
            var millData = millFoldersWithRollIDs[millName];
            if (millData && Object.keys(millData).length > 0) {
                allEmpty = false;

                folderList += "<div class='folder-item' onclick='showImages(\"" + millName + "\", " + JSON.stringify(millData) + ")'>" +
                    "<i class='fas fa-folder folder-icon fa-5x'></i>" +
                    "<div class='folder-details'>" +
                    "<button class='btn btn-link folder-btn'>" + millName + "</button>" + validateIcon +
                    "</div></div>";
            }
        }
    }

    if (allEmpty) {
        $('#folderNotFound').show();
        $('#millFolders').html('');
        $('#imageDisplay').html('');
        $('#folderTitle').html('');
        return;
    }

    folderList += "</div>";

    $('#millFolders').html(folderList);
    $('#folderNotFound').hide();
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

            imageData[rollNumber][date].forEach(function (imageDataItem) {
                var imageSrc = "/static" + imageDataItem.image_path.replace(/\\/g, "/").slice(imageDataItem.image_path.indexOf('/temp'));
                var coordinates = imageDataItem.coordinates;

                currentImageCoordinates.push(coordinates);
           
                imageStates[imageSrc] = imageDataItem.status;
          

                var borderColor = "";
                if (imageDataItem.status === "tp") {
                    borderColor = "green"; // True positive
                } else if (imageDataItem.status === "fp") {
                    borderColor = "red"; // False positive
                } else if (imageDataItem.status === "nmm") {
                    borderColor = "blue"; // Not manually marked
                } else {
                    borderColor = "black"; // Default to black if status is unknown
                }
                var borderStyle = "style='border: 2px solid " + borderColor + ";'";

                imageList += "<img src='" + imageSrc + "' alt='Image' onclick='openImageDialog(\"" + imageSrc + "\", " + JSON.stringify(coordinates) + ")' " + borderStyle + ">";
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
            } else {
                bootbox.hideAll();
            }
        }
    });
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
                    $('#imageModal').modal('hide');
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
    var validated = "validated";

    var countDetails = {};

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];
        if (state !== undefined) {
            var millName = getMillNameFromUrl(imageUrl);
            var unitName = getMillUnitNameFromUrl(imageUrl);
            var addname = getAddFromUrl(imageUrl);
            var machineName = getMillMachineNameFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);
            var cameraName = getCameraNameFromUrl(imageUrl);
            var label = getLabelFromUrl(imageUrl);

            var folderPath = validation_folder + millName + "/" + unitName + "/" + addname + "/" + machineName + "/" + rollNumber + "/" + date + "/" + cameraName + "/" + label + "/" + state;

            var imageData = {
                source: imageUrl,
                destination: folderPath,
                mill_name: millName,
                machine_name: machineName,
                date: date,
                count_details: [],
                comment: comment,
                validated: validated
            };

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

    var countDetailsArray = Object.values(countDetails);
    countDetailsArray.push({
        total: {
            total_tp_count: totalTPCount,
            total_fp_count: totalFPCount,
            total_nmm_count: totalNMMCount
        }
    });

    submissionData.forEach(function (imageData) {
        imageData.count_details = countDetailsArray;
    });

    submissionData.forEach(function (imageData) {
        $.ajax({
            type: "POST",
            url: "/move-image",
            data: JSON.stringify(imageData),
            processData: false,
            contentType: 'application/json',
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
    if (parts.length >= 8) {
        return parts[8];
    }
    return null;
}

function getCameraNameFromUrl(imageUrl) {
    var parts = imageUrl.split('/');
    if (parts.length >= 9) {
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
        var coordinates = currentImageCoordinates[currentImageIndex];

        if (coordinates !== undefined) {
            openImageDialog(imageUrl, coordinates);
            drawRectanglePlot(imageUrl, coordinates);
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
        var coordinates = currentImageCoordinates[currentImageIndex];

        openImageDialog(imageUrl, coordinates);
        drawRectanglePlot(imageUrl, coordinates);
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

function drawRectanglePlot(imageUrl, coordinates) {

    var img = new Image();

    img.src = imageUrl;

    img.onload = function () {
        var canvas = document.getElementById('imageCanvas');
        var ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        var x1 = coordinates[0][0]; // x coordinate of the first point
        var y1 = coordinates[0][1]; // y coordinate of the first point
        var x2 = coordinates[1][0]; // x coordinate of the second point
        var y2 = coordinates[1][1]; // y coordinate of the second point

        var width = x2 - x1;
        var height = y2 - y1;

        ctx.beginPath();
        ctx.rect(x1, y1, width, height);

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.closePath();
    };
}

function startSubtraction() {
    if (currentImageCoordinates.length > 0) {
        confirmationReceived = false;
        $('#editOptions, #editButton, #saveButton').hide();

        var firstImageUrl = $('#imageDisplay img:first').attr('src');
        var firstImageCoordinates = currentImageCoordinates[0];

        openImageDialog(firstImageUrl, firstImageCoordinates);
    } else {
        console.error("No images available for subtraction.");
    }
}

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
    var label = parts[parts.length - 2];

    $('#imageLabel').text("Label: " + label);
    drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the selected image
    $('#imageCanvas').attr('src', imageUrl);
    $('#imageModal').modal('show');


    if (confirmationReceived) {
        $('#editOptions, #editButton, #saveButton').show();

        var handleResponse = function (response) {
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


    } else {
        $('#editOptions, #editButton, #saveButton').hide();

        currentImages = $('#imageDisplay').find('img').map(function () {
            return $(this).attr('src');
        }).get();

        currentImageIndex = currentImages.indexOf(imageUrl);
        updateStatus(imageStates[imageUrl]);
        updateImageBorder(imageUrl);
        $('#imageCount').text((currentImageIndex + 1) + "/" + currentImages.length);
        updateSelectedImageBorder();
    }

}

