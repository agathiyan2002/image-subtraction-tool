var millFoldersWithRollIDs = {};
var validation_folder = "";
var alert_message = "";
var currentImageIndex = 0;
var currentImages = [];
var error_databases = [];

var imageStates = {};
var dateSent = false;
var currentImageUrl = "";
var currentImageCoordinates = [];
var editOptionValue = 'all_images';
var tpImages = [];
var fpImages = [];
var nmmImages = [];
var confirmationReceived = false;
var selectedMill = null;
var sortImages = [];
var unmarked = false;
var unMarkedimagestates = {}
var unmarkedmillName = "";
var unmarkedMachineName = "";
var validateionMachineFolders = {};
var allMachinenames = [];
var mill = "";
var milldas = {};
let validated = {};
var mfwroll = [];
var atervalid = {};
var validated_folder = {};
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
    validateionMachineFolders = {};
    currentImageCoordinates = [];
    validated_folder = {};
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

            updateFolderList(millFoldersWithRollIDs, validated_folder);
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

function updateFolderList(millFoldersWithRollIDs, validated_folder) {
    atervalid = validated_folder;
    var folderList = "<div class='folder-grid'>";
    var allEmpty = true;

    for (var millName in millFoldersWithRollIDs) {

        let valid = "notvalidated";
        let validateIcon = "";

        if (validated_folder && validated_folder.hasOwnProperty(millName)) {
            try {
                validated = validateionMachineFolders;

                validated = validated_folder[millName];

                validateionMachineFolders = validated;
                console.log("+++++", validated);

                valid = Object.values(validated).every(v => v === "validated") ? "validated" : "notvalidated";
                console.log("+++", valid);
                validateIcon = (valid === 'validated') ? "<i class='fas fa-check-circle'></i>" : "";
            } catch (e) {
                console.error("Error parsing JSON for millName:", millName, e);
            }
        }

        if (millFoldersWithRollIDs.hasOwnProperty(millName)) {
            var millData = millFoldersWithRollIDs[millName];
            if (millData && Object.keys(millData).length > 0) {
                allEmpty = false;

                folderList += "<div class='folder-item' onclick='showMachines(\"" + millName + "\", " + JSON.stringify(millData) + ")'>" +
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
    $('#backButton').addClass('d-none'); // Hide the back button for images
    $('#backToMillButton').addClass('d-none'); // Hide the back button for machine folders
}

function showMachines(millName, millData) {
    mill = millName;
    milldas = millData;

    selectedMill = millName;

    var folderList = "<div class='row'><button id='backToMillButton' class='btn btn-outline-secondary d-none' onclick='goBackToMillFolders()'>" +
        "<i class='fas fa-arrow-left'></i> Back</button></div>";

    folderList += "<div class='folder-grid'>";

    for (var machineName in millData) {
        allMachinenames.push(machineName.toString()); // Ensure machine names are strings

        if (millData.hasOwnProperty(machineName)) {

            for (let machineName in validateionMachineFolders) {
                if (validateionMachineFolders.hasOwnProperty(machineName)) {
                    let status = validateionMachineFolders[machineName];

                }
            }

            var validationStatus = validateionMachineFolders[machineName.toString()];


            var validateIcon = (validationStatus === 'validated') ? "<i class='fas fa-check-circle validated-icon'></i>" : "";

            folderList += "<div class='folder-item' onclick='showImages(\"" + millName + "\", \"" + machineName + "\", " + JSON.stringify(millData[machineName]) + ")'>" +
                "<i class='fas fa-folder folder-icon fa-5x'></i>" +
                "<div class='folder-details'>" +
                "<button class='btn btn-link folder-btn'>" + machineName + "</button>" +
                validateIcon + // Add the validation icon here
                "</div></div>";
        }
    }

    folderList += "</div>";

    $('#millFolders').html(folderList);
    $('#folderTitle').html('Machines in ' + millName);
    $('#backToMillButton').removeClass('d-none'); // Show the back button for machine folders
    $('#backButton').addClass('d-none'); // Hide the back button for images
}

function showImages(millName, machineName, imageData) {
    unmarkedmillName = millName;
    console.log("machineName", machineName);
    machineName = machineName.length === 3 ? `${machineName[0]}-${machineName.slice(1)}` : machineName;
    unmarkedMachineName = machineName;

    var imageList = "<div class='image-container'>";

    if (!unmarked) {

        for (var rollNumber in imageData) {
            for (var date in imageData[rollNumber]) {
                imageData[rollNumber][date].forEach(function (imageDataItem) {
                    var imageSrc = "/static" + imageDataItem.image_path.replace(/\\/g, "/").slice(imageDataItem.image_path.indexOf('/temp'));
                    var coordinates = imageDataItem.coordinates;
                    sortImages.push({ imagepath: imageSrc, coordinates: coordinates });

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
    } else {


        imageData.forEach(function (imageDataItem) {
            var imageSrc = imageDataItem.imagepath;
            var coordinates = imageDataItem.coordinates;

            var borderColor = "";
            if (unMarkedimagestates[imageSrc] === "tp") {
                borderColor = "green"; // True positive
            } else if (unMarkedimagestates[imageSrc] === "fp") {
                borderColor = "red"; // False positive
            } else if (unMarkedimagestates[imageSrc] === "nmm") {
                borderColor = "blue"; // Not manually marked
            } else {
                borderColor = "black"; // Default to black if status is unknown
            }
            var borderStyle = "style='border: 2px solid " + borderColor + ";'";

            imageList += "<img src='" + imageSrc + "' alt='Image' onclick='openImageDialog(\"" + imageSrc + "\", " + JSON.stringify(coordinates) + ")' " + borderStyle + ">";
            unmarked = false;
        });
    }

    imageList += "</div>";

    $('#editOptions, #editButton, #saveButton').hide();
    confirmationReceived = false;

    $('#imageDisplay').html(imageList);
    $('#folderTitle').html('Images in ' + machineName + ' (' + millName + ')');
    $('#millFolders').hide();
    $('#backButton').removeClass('d-none'); // Show the back button for images
    $('#backToMillButton').addClass('d-none'); // Hide the back button for machine folders
    $('#submitBtn').removeClass('d-none');
    $('#startSubtractionBtn').removeClass('d-none');

    // Update the machine name heading
    $('#machineNameHeading').text('Machine name: ' + machineName);
}

function goBackToMillFolders() {

    updateFolderList(millFoldersWithRollIDs, atervalid);
}

// Function to go back from images to machine folders
function goBack() {
    showMachines(selectedMill, millFoldersWithRollIDs[selectedMill]);
}

function goBack() {
    $('#millFolders').show();
    $('#backButton').addClass('d-none');

    $('#imageDisplay').html('');
    $('#folderTitle').html('');
}

function submitImages() {
    var unmarkedImages = []; // Initialize the unmarkedImages array inside the function

    var anyImageSelected = Object.values(imageStates).some(function (state) {
        return state !== undefined;
    });

    var allImagesMarked = true;
    for (var i = 0; i < currentImages.length; i++) {
        var imageUrl = currentImages[i];
        if (imageStates[imageUrl] === undefined) {
            unmarkedImages.push(imageUrl); // Push unmarked image paths to the array
            allImagesMarked = false;
        }
    }

    if (!anyImageSelected) {
        showErrorDialog("No images are selected for submission.");
        return;
    }

    if (!allImagesMarked) {
        showErrorDialog("You must mark all images before submission.");
        unmarked = true;

        var i = sortUnmarkedImagesFirst(unmarkedImages, sortImages);
        unMarkedimagestates = sortImageStates(imageStates, i);
        showImages(unmarkedmillName, unmarkedMachineName, i);
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
function sortUnmarkedImagesFirst(unmarkedImages, sortImages) {
    // Separate unmarked images and the rest
    var unmarked = [];
    var rest = [];

    sortImages.forEach(function (item) {
        if (unmarkedImages.includes(item.imagepath)) {
            unmarked.push(item);
        } else {
            rest.push(item);
        }
    });

    // Concatenate the unmarked images at the beginning
    var sortedImages = unmarked.concat(rest);

    return sortedImages;
}
function sortImageStates(imageStates, sortedImages) {
    let sortedImageStates = {};

    // Iterate over the sorted images array
    sortedImages.forEach(function (imageDataItem) {
        let imagePath = imageDataItem.imagepath;
        if (imageStates.hasOwnProperty(imagePath)) {
            sortedImageStates[imagePath] = imageStates[imagePath];
        }
    });

    // Include any remaining items in the original order, if they weren't in sortedImages
    for (let imagePath in imageStates) {
        if (!sortedImageStates.hasOwnProperty(imagePath)) {
            sortedImageStates[imagePath] = imageStates[imagePath];
        }
    }

    return sortedImageStates;
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

    var message = "<div style='margin-bottom: 10px;'><strong>Total:</strong> " + (tpCount + fpCount + nmmCount) + "</div>" +
        "<div style='margin-bottom: 5px;'><strong>TP:</strong> " + tpCount + "</div>" +
        "<div style='margin-bottom: 5px;'><strong>FP:</strong> " + fpCount + "</div>" +
        "<div style='margin-bottom: 5px;'><strong>NMM:</strong> " + nmmCount + "</div><br>" +
        "<textarea id='comment' placeholder='Enter your comment...' class='form-control mt-3'></textarea>";

    bootbox.dialog({
        title: "Show Details",
        message: message,
        className: 'show-details-dialog',
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

    allMachinenames.forEach(function (machineName) {
        if (machineName == unmarkedMachineName) {
            validateionMachineFolders[machineName] = "validated";
        } else if (validateionMachineFolders[machineName] !== "validated") {
            validateionMachineFolders[machineName] = "notvalidated";
        }
    });

    currentImages.forEach(function (imageUrl) {
        var state = imageStates[imageUrl];
        var machineName = getMillMachineNameFromUrl(imageUrl);

        if (state !== undefined) {
            var millName = getMillNameFromUrl(imageUrl);
            var unitName = getMillUnitNameFromUrl(imageUrl);
            var addname = getAddFromUrl(imageUrl);
            var machineName = getMillMachineNameFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);
            var cameraName = getCameraNameFromUrl(imageUrl);
            var label = getLabelFromUrl(imageUrl);
            validated_folder[millName] = validateionMachineFolders;

            var folderPath = validation_folder + millName + "/" + unitName + "/" + addname + "/" + machineName + "/" + rollNumber + "/" + date + "/" + cameraName + "/" + label + "/" + state;

            var imageData = {
                source: imageUrl,
                destination: folderPath,
                mill_name: millName,
                machine_name: machineName,
                date: date,
                count_details: [],
                comment: comment,
                validated: validateionMachineFolders[machineName],

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
                $('#backToMillButton').removeClass('d-none'); // Show the back button for machine folders
                $('#machineNameHeading').html('');

                currentImages = [];
                imageStates = {};
                currentImageCoordinates = [];
                unMarkedimagestates = {};
                sortImages = [];
                unmarkedImages = [];
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
    $('#machineNameHeading').text('');
    $('#machineNameHeading').html('');

    currentImages = [];
    imageStates = {};
    currentImageCoordinates = [];
    sortImages = [];
    unMarkedimagestates = {};
    sortImages = [];
    unmarkedImages = [];
    // unmarkedMachineName = "";
    showMachines(mill, milldas);

}

function drawRectanglePlot(imageUrl, coordinates) {

    var img = new Image();

    var defectName = imageUrl.split('/')[12];
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

        ctx.lineWidth = 3;
        ctx.strokeStyle = 'green'; // Set border color to green
        ctx.stroke();
        ctx.closePath();

        // Draw defect name like a price tag
        ctx.font = '16px Arial';
        ctx.fillStyle = 'green'; // Background for text
        ctx.fillRect(x1, y1 - 20, ctx.measureText(defectName).width + 10, 20); // Green background for text
        ctx.fillStyle = 'white';
        ctx.fillText(defectName, x1 + 5, y1 - 5);
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
    var roll_id = parts[parts.length - 7];


    var label = parts[parts.length - 2];

    $('#imageLabel').text("Label: " + label);
    $('#rollIdValue').text("Roll : " + roll_id);

    drawRectanglePlot(imageUrl, coordinates); // Draw rectangle for the selected image
    $('#imageCanvas').attr('src', imageUrl);
    $('#imageModal').modal('show');


    if (confirmationReceived) {
        $('#editOptions, #editButton, #saveButton').show();

        var handleResponse = function (response) {
            if (editOptionValue === 'false_positive') {
                currentImages = response.false_positive_image;

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

