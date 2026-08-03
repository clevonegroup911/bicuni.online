document.addEventListener('DOMContentLoaded', function () {
	var toggle = document.querySelector('[data-mobile-nav]');
	var menu = document.querySelector('[data-mobile-menu]');
	if (toggle && menu) {
		toggle.addEventListener('click', function () {
			var isOpen = menu.classList.toggle('open');
			toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
		});
	}

	var sidebar = document.querySelector('[data-sidebar]');
	var openSidebar = document.querySelector('[data-sidebar-open]');
	var closeSidebar = document.querySelector('[data-sidebar-close]');
	if (sidebar && openSidebar) {
		openSidebar.addEventListener('click', function () {
			sidebar.classList.add('open');
		});
	}
	if (sidebar && closeSidebar) {
		closeSidebar.addEventListener('click', function () {
			sidebar.classList.remove('open');
		});
	}
});
