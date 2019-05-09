function initLokomotiveSlider() {
  return new Swiper ('#lokomotive-slider', {
    slidesPerView: 2,
    spaceBetween: 20,
    grabCursor: true,
    allowTouchMove: true,

    pagination: {
      el: '#lokomotive-slider__pagination'
    },

    on: {
      resize: function () {
        this.update();
        if(window.innerWidth > 767) {
          this.destroy(false, true);
        }

        // this.update();
      },
    },

    breakpoints: {
      576: {
        slidesPerView: 1,
        spaceBetween: 10,
        grabCursor: true,
        allowTouchMove: true
      }
    }
  });
}

if(window.innerWidth < 768) {
  initLokomotiveSlider();
}

window.onresize = function() {
  if(window.innerWidth < 768) {
    initLokomotiveSlider();
  }
}