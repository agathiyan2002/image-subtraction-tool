var millFoldersWithRollIDs = {};
var validation_folder = "";
var alert_message = "";
var currentImageIndex = 0;
var currentImages = [];
var error_databases = [];
var imageStates = {};
var dateSent = false;

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
    var folderList = "<ul>";
    millFoldersWithRollIDs.forEach(function (millData) {
        for (var millName in millData) {
            folderList += "<li><img src='static/assets/icons8-folder-48.png' class='folder-icon' />" +
                "<button class='btn btn-link folder-btn' onclick='showImages(\"" + millName + "\", " + JSON.stringify(millData[millName]) + ")'>" +
                millName + "</button></li>";
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
                imageList += "<img src='" + imageDataItem.image_path.replace(/\\/g, "/") + "' alt='Image' onclick='openImageDialog(\"" + imageDataItem.image_path.replace(/\\/g, "/") + "\")'>";
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
                showSecondaryDialog();
            } else {
                bootbox.hideAll();
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

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];

        if (state !== undefined) {
            var millName = getMillNameFromUrl(imageUrl);
            var machineName = getMillMachineNameFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);
            var folderPath = validation_folder + millName + "/" + machineName + "/" + rollNumber + "/" + date + "/" + state;
            var imageData = new FormData();

            imageData.append('source', imageUrl);
            imageData.append('destination', folderPath);
            imageData.append('mill_name', millName);
            imageData.append('machine_name', machineName);
            imageData.append('date', date);
            imageData.append('total_fp_count', 0);
            imageData.append('total_tp_count', 0);
            imageData.append('total_nmm_count', 0);
            imageData.append('comment', comment);

            if (state === 'tp') {
                totalTPCount++;
            } else if (state === 'fp') {
                totalFPCount++;
            } else if (state === 'nmm') {
                totalNMMCount++;
            }

            submissionData.push(imageData);
        }
    });

    submissionData.forEach(function (imageData) {
        imageData.set('total_fp_count', totalFPCount);
        imageData.set('total_tp_count', totalTPCount);
        imageData.set('total_nmm_count', totalNMMCount);
    });

    submissionData.forEach(function (imageData) {
        console.log(imageData.get('source'));
        $.ajax({
            type: "POST",
            url: "/move-image",
            data: imageData,
            processData: false,
            contentType: false,
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

    if (tpImages.length > 0) {
        showImagesSeparately('True Positive', tpImages);
    }

    if (fpImages.length > 0) {
        showImagesSeparately('False Positive', fpImages);
    }

    if (nmmImages.length > 0) {
        showImagesSeparately('Name Mismatch', nmmImages);
    }
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

function openImageDialog(imageUrl) {
    var parts = imageUrl.split('/');
    var label = parts[parts.length - 2];

    $('#imageLabel').text("Label: " + label);

    $('#imageFrame').attr('src', imageUrl);
    $('#imageModal').modal('show');

    currentImages = $('#imageDisplay').find('img').map(function () {
        return $(this).attr('src');
    }).get();

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

function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        var imageUrl = currentImages[currentImageIndex];
        $('#imageFrame').attr('src', imageUrl);
        openImageDialog(imageUrl);
        updateSelectedImageBorder();
    }
}

function showNextImage() {
    if (currentImageIndex < currentImages.length - 1) {
        currentImageIndex++;
        var imageUrl = currentImages[currentImageIndex];
        $('#imageFrame').attr('src', imageUrl);
        openImageDialog(imageUrl);
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
