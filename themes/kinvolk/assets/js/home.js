function initLokomotiveSlider() {
  return new Swiper ('#lokomotive-slider', {
    slidesPerView: 2,
    spaceBetween: 30,

    pagination: {
      el: '#lokomotive-slider__pagination',
      clickable: true
    },

    on: {
      resize: function () {
        if(window.innerWidth > 767) {
          this.destroy(false, true);
        }

        this.update();
      },
    },

    breakpoints: {
      576: {
        slidesPerView: 1,
        spaceBetween: 10
      }
    }
  });
}

function validateEmail(email) {
  var filter = /^([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
  if (filter.test(email)) {
    return true;
  }
  else {
    return false;
  }
};

$("#contact-us-form").on("submit", function (event) {
  event.preventDefault();

  var email = $("#input-email");
  var name = $("#input-name");
  var message = $("#input-message");

  var emailValid = false;
  var nameValid = false;
  var messageValid = false;

  console.log($(email).val());

  var emailValue = $(email).val().trim();
  var nameValue = $(name).val().trim();
  var messageValue = $(message).val().trim();

  if (emailValue && validateEmail(emailValue)) {
    emailValid = true;

    email.removeClass("invalid");
  } else {
    emailValid = false;

    email.addClass("invalid");
  }

  if (messageValue) {
    messageValid = true;

    message.removeClass("invalid");
  } else {
    messageValid = false;

    message.addClass("invalid");
  }

  if (nameValue) {
    nameValid = true;

    name.removeClass("invalid");
  } else {
    nameValid = false;

    name.addClass("invalid");
  }

  if (emailValid && messageValid && nameValid) {
    this.submit();
  }
});

$(".form__input").each(function(key, input) {
  ["input", "keyup"].forEach(function(event) {
    input.addEventListener(event, function() {
      if(this.classList.contains("invalid")) {
        this.classList.remove("invalid");
      }
    })
  })
});

if(window.innerWidth < 768) {
  initLokomotiveSlider();
}

window.onresize = function() {
  if(window.innerWidth < 768) {
    initLokomotiveSlider();
  }
}