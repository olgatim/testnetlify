findElement(".contact-us-form").addEventListener("submit", function (event) {
  event.preventDefault();

  var email = findElement("#contact-mail");
  var name = findElement("#contact-name");
  var message = findElement("#contact-message");

  var emailValid = false;
  var nameValid = false;
  var messageValid = false;

  var emailValue = email.value.trim();
  var nameValue = name.value.trim();
  var messageValue = message.value.trim();

  if (emailValue && validateEmail(emailValue)) {
    emailValid = true;

    email.classList.remove("invalid");
  } else {
    emailValid = false;

    email.classList.add("invalid");
  }

  if (messageValue) {
    messageValid = true;

    message.classList.remove("invalid");
  } else {
    messageValid = false;

    message.classList.add("invalid");
  }

  if (nameValue) {
    nameValid = true;

    name.classList.remove("invalid");
  } else {
    nameValid = false;

    name.classList.add("invalid");
  }

  if (emailValid && messageValid && nameValid) {
    var data = {
      "from": "kinvolk.io",
      "name": nameValue,
      "email": emailValue,
      "message": messageValue
    };
  }
});

function validateEmail(email) {
  var filter = /^([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
  if (filter.test(email)) {
    return true;
  }
  else {
    return false;
  }
};