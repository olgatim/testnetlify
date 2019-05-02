new Swiper ('#lokomotive-slider', {
    slidesPerView: 3,
    grabCursor: false,
    allowTouchMove: false,

    pagination: {
      el: '#lokomotive-slider__pagination'
    },

    on: {
      resize: function () {
        this.update();
      },
    },

    breakpoints: {
      576: {
        slidesPerView: 1,
        spaceBetween: 20,
        grabCursor: true,
        allowTouchMove: true
      }
    }
  });