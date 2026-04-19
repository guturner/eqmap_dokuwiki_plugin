<?php
/**
 * DokuWiki Plugin eqmap (Action Component)
 *
 * Handles two side-effects that must fire outside the normal syntax render cycle:
 *
 *   1. Toolbar button — injects a convenience button into the DokuWiki editor
 *      toolbar so authors can insert a starter <eqmap> tag with one click.
 *
 *   2. Base URL — injects `window.eqmapBase` into the page <head> so that
 *      eqmap.js can construct absolute URLs to bundled assets (icons, map
 *      images) without hard-coding any path.
 *
 * @license GPL-2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Guy Turner <guy.alexander.turner@gmail.com>
 */

// Bail early if not inside DokuWiki.
if (!defined('DOKU_INC')) die();

use dokuwiki\Extension\ActionPlugin;
use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

class action_plugin_eqmap extends ActionPlugin
{
    /** Starter POI so the toolbar snippet renders something visible immediately. */
    private const TOOLBAR_SAMPLE_POI = [
        ['name' => 'Qeynos', 'color' => 'red', 'lat' => 666.0, 'lon' => 2299.0],
    ];

    public function register(EventHandler $controller): void
    {
        $controller->register_hook('TOOLBAR_DEFINE',      'AFTER',  $this, 'insertButton');
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'addBaseUrl');
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    /**
     * Add an "Insert eqmap" button to the DokuWiki editor toolbar.
     *
     * The inserted snippet includes every supported attribute so authors can
     * see the full syntax at a glance and delete what they don't need.
     */
    public function insertButton(Event $event): void
    {
        $poisJson = json_encode(self::TOOLBAR_SAMPLE_POI);

        $openTag = implode(' ', [
            '<eqmap',
            'centered',
            'debug',
            'centerLat=1234.5',
            'centerLon=4321.0',
            'zoom=6',
            "poi='" . $poisJson . "'>",
        ]);

        $event->data[] = [
            'type'   => 'format',
            'title'  => 'Map of Norrath',
            'icon'   => '../../plugins/eqmap/icons/icon.png',
            'open'   => $openTag,
            'sample' => '',
            'close'  => '</eqmap>',
        ];
    }

    /**
     * Inject `window.eqmapBase` into the page <head> before other scripts run.
     *
     * eqmap.js reads this variable to resolve asset paths at runtime, which
     * keeps the JS free of any DokuWiki-specific path logic.
     */
    public function addBaseUrl(Event $event): void
    {
        $pluginUrl = DOKU_URL . 'lib/plugins/eqmap/';

        $event->data['script'][] = [
            'type'  => 'text/javascript',
            '_data' => 'var eqmapBase = ' . json_encode($pluginUrl) . ';',
            'defer' => 'defer',
        ];
    }
}