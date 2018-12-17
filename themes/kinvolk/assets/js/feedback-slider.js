function initFeedbackSlider () {
  var mySwiper = new Swiper ('#feedback-slider', {
    slidesPerView: 3,
    spaceBetween: 60,
    slidesPerGroup: 3,
    grabCursor: true,

    pagination: {
      el: '#feedback-slider__pagination'
    },
  
    navigation: {
      nextEl: '#feedback-slider__button-next',
      prevEl: '#feedback-slider__button-prev',
    },

    breakpoints: {
      1279: {
        slidesPerView: 3,
        spaceBetween: 40,
        slidesPerGroup: 3
      },
      1200: {
        slidesPerView: 2,
        spaceBetween: 40,
        slidesPerGroup: 1
      },
      720: {
        slidesPerView: 2,
        spaceBetween: 20,
        slidesPerGroup: 1
      },
      520: {
        slidesPerView: 1,
        spaceBetween: 16,
        slidesPerGroup: 1
      }
    }
  })
};