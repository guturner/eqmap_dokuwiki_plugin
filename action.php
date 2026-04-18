<?php

use dokuwiki\Extension\ActionPlugin;
use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

/**
 * DokuWiki Plugin eqmap (Action Component)
 *
 * @license GPL 2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author Guy Turner <guy.alexander.turner@gmail.com>
 */
class action_plugin_eqmap extends ActionPlugin
{
    /** @inheritDoc */
    public function register(EventHandler $controller)
    {
		$controller->register_hook('TOOLBAR_DEFINE', 'AFTER', $this, 'insertButton');
		$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'addBaseUrl');
    }

    final public function insertButton(Event $event): void
    {
		$open_string = '<eqmap centered centerLat=1234.5 centerLon=4321.0 zoom=6 ';
		$open_string .= 'poi=\'[{"name":"Base Camp","color":"red","lat":1234.5,"lon":4321.0}]\'>';
		
        $event->data[] = ['type' => 'format', 'title' => 'Map of Norrath', 'icon' => '../../plugins/eqmap/icons/icon.png', 'open' => $open_string, 'sample' => '', 'close' => '</eqmap>'];
    }
	
	final public function addBaseUrl(Event $event): void
    {
        $pluginUrl = DOKU_URL . 'lib/plugins/eqmap/';
        $event->data['script'][] = [
        'type'  => 'text/javascript',
        '_data' => 'var eqmapBase = ' . json_encode($pluginUrl) . ';',
        'defer' => 'defer'
    ];
    }
}
