// Initialize Swiper for testimonials
// Swiper initialization
var swiper = new Swiper('.swiper-container', {
    loop: true,  // This allows continuous loop of slides
    autoplay: {
        delay: 4000, // Slide transition every 4 seconds
        disableOnInteraction: false, // Keeps autoplay running after interaction
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true, // Makes the pagination bullets clickable
    },
    effect: 'slide', // Ensure the effect is 'slide' for smooth transitions
    spaceBetween: 30, // Optional: Adds space between slides for better appearance
});


// Initialize modals
function initModals() {
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    const btn = document.getElementById('loginBtn');
    const span = document.getElementsByClassName('close')[0];

    btn.onclick = function() {
        modal.style.display = 'block';
    }

    span.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initSwiper();
    initModals();
    
    // Add active class to current page in navigation
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('nav ul li a');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
});