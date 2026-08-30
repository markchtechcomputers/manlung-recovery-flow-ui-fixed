/*
============================================================
MANLUNG RECOVERY
MOBILE NAVIGATION CONTROLLER
============================================================
*/

(function () {

    'use strict';


    function setupMobileNavigation() {

        const headers =
            document.querySelectorAll('.site-header');


        headers.forEach(function (header) {

            const toggle =
                header.querySelector(
                    '.mobile-menu-toggle'
                );

            const menu =
                header.querySelector(
                    '.mobile-nav'
                );

            const close =
                header.querySelector(
                    '.mobile-menu-close'
                );


            if (!toggle || !menu) {
                return;
            }


            function closeMenu() {

                menu.classList.remove(
                    'is-open'
                );

                toggle.setAttribute(
                    'aria-expanded',
                    'false'
                );

                toggle.setAttribute(
                    'aria-label',
                    'Open navigation menu'
                );

                document.body.classList.remove(
                    'mobile-menu-open'
                );

                document.body.classList.remove(
                    'manlung-mobile-menu-open'
                );
            }


            function openMenu() {

                if (window.innerWidth >= 768) {
                    return;
                }

                menu.classList.add(
                    'is-open'
                );

                toggle.setAttribute(
                    'aria-expanded',
                    'true'
                );

                toggle.setAttribute(
                    'aria-label',
                    'Close navigation menu'
                );

                document.body.classList.add(
                    'mobile-menu-open'
                );

                document.body.classList.add(
                    'manlung-mobile-menu-open'
                );
            }


            function toggleMenu(event) {

                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                if (window.innerWidth >= 768) {
                    closeMenu();
                    return;
                }

                if (
                    menu.classList.contains(
                        'is-open'
                    )
                ) {

                    closeMenu();

                } else {

                    openMenu();

                }
            }


            /* HAMBURGER */

            if (
                toggle.dataset.mobileNavReady !==
                'true'
            ) {

                toggle.dataset.mobileNavReady =
                    'true';

                toggle.addEventListener(
                    'click',
                    toggleMenu
                );
            }


            /* X CLOSE BUTTON */

            if (
                close &&
                close.dataset.mobileNavReady !==
                'true'
            ) {

                close.dataset.mobileNavReady =
                    'true';

                close.addEventListener(
                    'click',
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        closeMenu();

                    }
                );
            }


            /* NAVIGATION LINKS */

            menu.querySelectorAll('a').forEach(
                function (link) {

                    if (
                        link.dataset.mobileNavLinkReady ===
                        'true'
                    ) {
                        return;
                    }

                    link.dataset.mobileNavLinkReady =
                        'true';

                    link.addEventListener(
                        'click',
                        function () {

                            closeMenu();

                        }
                    );
                }
            );


            /* CLICK OUTSIDE */

            if (
                header.dataset.mobileOutsideReady !==
                'true'
            ) {

                header.dataset.mobileOutsideReady =
                    'true';

                document.addEventListener(
                    'click',
                    function (event) {

                        if (
                            window.innerWidth >=
                            768
                        ) {
                            closeMenu();
                            return;
                        }


                        if (
                            !menu.classList.contains(
                                'is-open'
                            )
                        ) {
                            return;
                        }


                        if (
                            !menu.contains(
                                event.target
                            ) &&
                            !toggle.contains(
                                event.target
                            )
                        ) {

                            closeMenu();

                        }

                    }
                );
            }


            /* ESCAPE */

            if (
                header.dataset.mobileEscapeReady !==
                'true'
            ) {

                header.dataset.mobileEscapeReady =
                    'true';

                document.addEventListener(
                    'keydown',
                    function (event) {

                        if (
                            event.key ===
                            'Escape'
                        ) {

                            closeMenu();

                        }

                    }
                );
            }


            /* RESIZE */

            if (
                header.dataset.mobileResizeReady !==
                'true'
            ) {

                header.dataset.mobileResizeReady =
                    'true';

                window.addEventListener(
                    'resize',
                    function () {

                        if (
                            window.innerWidth >=
                            768
                        ) {

                            closeMenu();

                        }

                    }
                );
            }


            /* INITIAL STATE */

            closeMenu();

        });

    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            setupMobileNavigation
        );

    } else {

        setupMobileNavigation();

    }

})();
