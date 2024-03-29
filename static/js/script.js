
// JavaScript code
var millFoldersWithRollIDs = {};
var currentImageIndex = 0;
var currentImages = [];
var imageStates = {}; // Object to store the state (true/false positive) of each image
var dateSent = false; // Flag to track if the date has been sent

$(document).ready(function () {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });

    // Listen for keyboard events
    $(document).keydown(function (e) {
        // Check if the modal is visible and arrow keys are pressed
        if ($('#imageModal').is(':visible')) {
            if (e.key === 'a') {
                // 'a' key pressed (Previous image)
                showPreviousImage();
            } else if (e.key === 'd') {
                // 'd' key pressed (Next image)
                showNextImage();
            } else if (e.key === 'ArrowLeft') {
                // Left arrow key pressed (Set false positive)
                setImageState(false);
            } else if (e.key === 'ArrowRight') {
                // Right arrow key pressed (Set true positive)
                setImageState(true);
            }
        }
    });
});

function showMillFolders() {
    var selectedDate = $('.datepicker').datepicker('getDate');
    var formattedDate = selectedDate.getFullYear() + "-" + (selectedDate.getMonth() + 1) + "-" + selectedDate.getDate();
    millFoldersWithRollIDs = [];

    $.ajax({
        type: "POST",
        url: "/",
        data: { date: formattedDate },
        success: function (response) {
            millFoldersWithRollIDs = JSON.parse(response);
            // console.log(millFoldersWithRollIDs);
            updateFolderList();
        },
        error: function (xhr, status, error) {
            console.error(xhr.responseText); // Print error message if any
        }
    });

    dateSent = true;

    function updateFolderList() {
        // console.log("this update folder list ", millFoldersWithRollIDs);
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
        $('#backButton').removeClass('d-none'); // Show back button when showing mill folders
        $('#imageDisplay').html(''); // Clear any previously displayed images
        $('#folderTitle').html(''); // Clear the folder title
    }

}


function showImages(millFolder, imageData) {
    var imageList = "<div class='image-container'>";

    for (var rollNumber in imageData) {
        for (var date in imageData[rollNumber]) {
            var imagesCount = imageData[rollNumber][date].length;
            console.log("Roll Number:", rollNumber, "Date:", date, "Images Count:", imagesCount);

            imageData[rollNumber][date].forEach(function (imageDataItem) {
                // console.log("imageDataItem", imageDataItem.image_path);
                imageList += "<img src='" + imageDataItem.image_path.replace(/\\/g, "/") + "' alt='Image' onclick='openImageDialog(\"" + imageDataItem.image_path.replace(/\\/g, "/") + "\")'>";
            });
        }
    }

    imageList += "</div>";

    $('#imageDisplay').html(imageList);
    $('#folderTitle').html('All Images in ' + millFolder); // Display the selected mill folder in the title

    // Hide the list of all mill folders
    $('#millFolders').hide();

    // Show the back button
    $('#backButton').removeClass('d-none');
}


function goBack() {
    // Show all mill folders
    $('#millFolders').show();

    // Hide the back button
    $('#backButton').addClass('d-none');

    // Clear the image display and folder title
    $('#imageDisplay').html('');
    $('#folderTitle').html('');
}

function submitImages() {
    // Loop through all images and move them to the destination folder based on their label and state
    currentImages.forEach(function (imageUrl) {
        var isTruePositive = imageStates[imageUrl];

        // Check if the image state is specified (true positive or false positive)
        if (isTruePositive !== undefined) {
            var imageLabel = getImageLabelFromUrl(imageUrl);
            var rollNumber = getRollNumberFromUrl(imageUrl);
            var date = getDateFromUrl(imageUrl);

            if (imageLabel && rollNumber && date) {
                var folderPath = "C:/Users/91984/Desktop/validation/" + "kpr-2/" + rollNumber + "/" + date + "/" + imageLabel + "/" + (isTruePositive ? "tp" : "fp");

                // Perform AJAX request to move the image file to the destination folder
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
                        console.error(xhr.responseText); // Print error message if any
                    }
                });
            }
        }
    });

    // Inform user that images have been submitted
    alert('Images submitted!');
    goBack();
}


function getImageLabelFromUrl(imageUrl) {
    // Extract label from the image URL
    var parts = imageUrl.split('/');
    if (parts.length >= 2) {
        return parts[parts.length - 2]; // Assuming the label is the second-to-last part of the URL
    }
    return null;
}



function openImageDialog(imageUrl) {
    // console.log("opnedialog ", imageUrl);
    $('#imageFrame').attr('src', imageUrl); // Set the source of the iframe to the clicked image URL
    $('#imageModal').modal('show'); // Show the modal dialog

    // Update current images array
    currentImages = $('#imageDisplay').find('img').map(function () {
        return $(this).attr('src');
    }).get();

    // Set current image index
    currentImageIndex = currentImages.indexOf(imageUrl);
}

// Show previous image
function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        $('#imageFrame').attr('src', currentImages[currentImageIndex]);
        updateImageBorder(currentImages[currentImageIndex]);
    }
}

// Show next image
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

    // Update border color based on the state
    updateImageBorder(currentImageUrl);

    // Check if any image has been marked as true positive or false positive
    var anyImageSelected = Object.values(imageStates).some(function (state) {
        return state !== undefined;
    });

    // Show or hide the submit button based on the condition
    if (anyImageSelected) {
        $('#submitBtn').show(); // Show the submit button
    } else {
        $('#submitBtn').hide(); // Hide the submit button
    }
}


function updateImageBorder(imageUrl) {
    var isTruePositive = imageStates[imageUrl];

    // Find the image element
    var $image = $('[src="' + imageUrl + '"]');

    if (isTruePositive === undefined) {
        // If the state is not defined, reset the border color
        $image.css({
            'border': 'none',
            'margin': '5px' // Add margin
        });
    } else {
        if (isTruePositive) {
            // Set border color to green for true positive and increase thickness
            $image.css({
                'border': '4px solid green',
                'margin': '5px' // Add margin
            });
        } else {
            // Set border color to red for false positive and increase thickness
            $image.css({
                'border': '4px solid red',
                'margin': '5px' // Add margin
            });
        }
    }
}

function goBack() {
    // Show all mill folders
    $('#millFolders').show();

    // Hide the back button
    $('#backButton').addClass('d-none');

    // Clear the image display and folder title
    $('#imageDisplay').html('');
    $('#folderTitle').html('');

    // Clear the current images and image states
    currentImages = [];
    imageStates = {};
}

// Function to extract the roll number from the image URL
function getRollNumberFromUrl(imageUrl) {
    // Example URL format: C:/Users/91984/Desktop/data/kpr-2/41/2024-03-16/lycre/image.jpg
    var regex = /kpr-2\/(\d+)\/\d{4}-\d{2}-\d{2}\//; // Regex pattern to match the roll number
    var match = imageUrl.match(regex);
    if (match && match.length > 1) {
        return match[1]; // Return the captured roll number
    }
    return null; // Return null if no match is found
}
// Function to extract the date from the image URL
function getDateFromUrl(imageUrl) {
    // Example URL format: C:/Users/91984/Desktop/data/kpr-2/41/2024-03-16/lycre/image.jpg
    var regex = /\d{4}-\d{2}-\d{2}/; // Regex pattern to match the date
    var match = imageUrl.match(regex);
    if (match && match.length > 0) {
        return match[0]; // Return the captured date
    }
    return null; // Return null if no match is found
}
