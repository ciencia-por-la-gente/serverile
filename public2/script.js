// Select your input type file and store it in a variable
const input = document.getElementById('fileinput');

// This will upload the file after having read it
const upload = (file) => {
  fetch('/sendConv', { // Your POST endpoint
    method: 'POST',
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: file // This is your file object
  }).then(
    response => response.json() // if the response is a JSON object
  ).then(
    success => {
      console.log(success)
      document.getElementById('risk').innerText = `${(success.score/9)*100}%`;
    } // Handle the success response object
  ).catch(
    error => console.log(error) // Handle the error response object
  );
};

// Event handler executed when a file is selected
const onSelectFile = () => upload(input.files[0]);

// Add a listener on your input
// It will be triggered when a file will be selected
input.addEventListener('change', onSelectFile, false);