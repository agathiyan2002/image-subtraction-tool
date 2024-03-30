var millFoldersWithRollIDs = {};
var validation_folder = "";
var currentImageIndex = 0;
var currentImages = [];
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
                setImageState(false);
            } else if (e.key === 'ArrowRight') {
                setImageState(true);
            }
        }
    });
});

function showMillFolders() {
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
        $('#backButton').removeClass('d-none');
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
    currentImages.forEach(function (imageUrl) {
        var isTruePositive = imageStates[imageUrl];

        if (isTruePositive !== undefined) {
            var millName = getMillNameFromUrl(imageUrl);

            if (millName) {
                var imageLabel = getImageLabelFromUrl(imageUrl);
                var rollNumber = getRollNumberFromUrl(imageUrl);
                var date = getDateFromUrl(imageUrl);
                var machine_name = getMillMachineNameFromUrl(imageUrl);

                if (imageLabel && rollNumber && date) {
                    var folderPath = validation_folder + millName + "/" + machine_name + "/" + rollNumber + "/" + date + "/" + imageLabel + "/" + (isTruePositive ? "tp" : "fp");

                    $.ajax({
                        type: "POST",
                        url: "/move-image",
                        data: {
                            source: imageUrl,
                            destination: folderPath
                        },
                        success: function (response) {
                            console.log(response);
                        },
                        error: function (xhr, status, error) {
                            console.error(xhr.responseText);
                        }
                    });
                } else {
                    console.log("Not work ");
                }
            }
        }
    });

    alert('Images submitted!');
    goBack();
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
    $('#imageFrame').attr('src', imageUrl);
    $('#imageModal').modal('show');

    currentImages = $('#imageDisplay').find('img').map(function () {
        return $(this).attr('src');
    }).get();

    currentImageIndex = currentImages.indexOf(imageUrl);
}

function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        $('#imageFrame').attr('src', currentImages[currentImageIndex]);
        updateImageBorder(currentImages[currentImageIndex]);
    }
}

function showNextImage() {
    if (currentImageIndex < currentImages.length - 1) {
        currentImageIndex++;
        $('#imageFrame').attr('src', currentImages[currentImageIndex]);
        updateImageBorder(currentImages[currentImageIndex]);
    }
}

function setImageState(isTruePositive) {
    var currentImageUrl = currentImages[currentImageIndex];
    imageStates[currentImageUrl] = isTruePositive;

    updateImageBorder(currentImageUrl);

    var anyImageSelected = Object.values(imageStates).some(function (state) {
        return state !== undefined;
    });

    if (anyImageSelected) {
        $('#submitBtn').show();
    } else {
        $('#submitBtn').hide();
    }
}

function updateImageBorder(imageUrl) {
    var isTruePositive = imageStates[imageUrl];
    var $image = $('[src="' + imageUrl + '"]');

    if (isTruePositive === undefined) {
        $image.css({
            'border': 'none',
            'margin': '5px'
        });
    } else {
        if (isTruePositive) {
            $image.css({
                'border': '4px solid green',
                'margin': '5px'
            });
        } else {
            $image.css({
                'border': '4px solid red',
                'margin': '5px'
            });
        }
    }
}

function goBack() {
    $('#millFolders').show();
    $('#backButton').addClass('d-none');
    $('#imageDisplay').html('');
    $('#folderTitle').html('');

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
