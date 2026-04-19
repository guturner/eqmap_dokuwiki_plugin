<?php
/**
 * DokuWiki Plugin eqmap (Syntax Component)
 *
 * Registers the <eqmap> tag and renders an interactive OpenLayers map
 * of Norrath directly in a DokuWiki page.
 *
 * Usage:
 *   <eqmap [options]></eqmap>
 *
 * Options (all optional):
 *   centered               — centres the map horizontally on the page
 *   centerLat=<float>      — initial map centre, latitude (pixel coord)
 *   centerLon=<float>      — initial map centre, longitude (pixel coord)
 *   zoom=<int>             — initial zoom level (default: 2, max: 8)
 *   poi='[{…}, …]'         — JSON array of point-of-interest objects
 *   info="<html>"          — HTML shown in the info (?) overlay
 *   debug                  — overlays a coordinate grid for authoring
 *
 * POI object shape:
 *   { "name": "string", "color": "red|green|grey|1-6", "lat": float, "lon": float }
 *
 * @license GPL-2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Guy Turner <guy.alexander.turner@gmail.com>
 */

// Bail early if not inside DokuWiki.
if (!defined('DOKU_INC')) die();

class syntax_plugin_eqmap extends DokuWiki_Syntax_Plugin
{
    public function getType(): string
    {
        return 'substition';
    }

    public function getPType(): string
    {
        return 'block';
    }

    public function getSort(): int
    {
        return 901;
    }

    public function connectTo($mode): void
    {
        $this->Lexer->addSpecialPattern(
            '<eqmap ?[^>\n]*>.*?</eqmap>',
            $mode,
            'plugin_eqmap'
        );
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    /**
     * Parse the matched <eqmap> tag into a structured data array.
     *
     * Returns an associative array so individual fields can be added or removed without breaking positional assumptions downstream.
     *
     * @param string       $match   Raw text matched by the lexer pattern.
     * @param int          $state   Lexer state (always DOKU_LEXER_SPECIAL here).
     * @param int          $pos     Character offset of the match in the source.
     * @param Doku_Handler $handler Reference to the current parser handler.
     * @return array{
     *   centered:   bool,
     *   centerLat:  string|null,
     *   centerLon:  string|null,
     *   zoom:       string|null,
     *   pois:       array,
     *   info:       string,
     *   debug:      bool,
     * }
     */
    public function handle($match, $state, $pos, Doku_Handler $handler): array
    {
        $attrString = $this->extractAttributeString($match);

        return [
            'centered'  => $this->hasFlag('centered', $attrString),
            'centerLat' => $this->extractFloat('centerLat', $attrString),
            'centerLon' => $this->extractFloat('centerLon', $attrString),
            'zoom'      => $this->extractInt('zoom', $attrString),
            'pois'      => $this->extractPois($attrString),
            'info'      => $this->extractInfo($match),
            'debug'     => $this->hasFlag('debug', $attrString),
        ];
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    /**
     * Emit the HTML that bootstraps the map on the page.
     *
     * The map is driven by a `poiData` JS object injected here; the actual OL
     * map is initialised by eqmap.js once the DOM is ready.
     */
    public function render($mode, Doku_Renderer $renderer, $data): bool
    {
        if ($mode !== 'xhtml') {
            return false;
        }

        $renderer->doc .= $this->renderPoiDataScript($data);
        $renderer->doc .= $this->renderMapHtml($data);

        return true;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Pull the raw attribute string out of the opening <eqmap …> tag.
     *
     * e.g. '<eqmap centered zoom=3>…</eqmap>' → 'centered zoom=3'
     */
    private function extractAttributeString(string $match): string
    {
        // Strip '<eqmap' prefix, then take everything up to the first '>'.
        $withoutTag = ltrim(substr($match, 6)); // 6 = strlen('<eqmap')
        $gtPos      = strpos($withoutTag, '>');

        return $gtPos !== false ? substr($withoutTag, 0, $gtPos) : '';
    }

    /**
     * Return true when a bare flag keyword (e.g. "centered", "debug") is
     * present in the attribute string.
     */
    private function hasFlag(string $flag, string $attrString): bool
    {
        return (bool) preg_match('/\b' . preg_quote($flag, '/') . '\b/', $attrString);
    }

    /**
     * Extract a named float attribute (e.g. centerLat=1234.5).
     * Returns null if the attribute is absent.
     */
    private function extractFloat(string $name, string $attrString): ?string
    {
        if (preg_match('/' . preg_quote($name, '/') . '=(\d+(?:\.\d+)?)/', $attrString, $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Extract a named integer attribute (e.g. zoom=3).
     * Returns null if the attribute is absent.
     */
    private function extractInt(string $name, string $attrString): ?string
    {
        if (preg_match('/' . preg_quote($name, '/') . '=(\d+)/', $attrString, $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Extract and JSON-decode the poi='[…]' attribute.
     * Returns an empty array on parse failure or absence.
     */
    private function extractPois(string $attrString): array
	{
		// 1. Match the content inside the poi='...' or poi="..." attribute
		if (!preg_match('/\bpoi=([\'"])(.*?)\1\s*(?:\w+=|$|\>)/', $attrString . ' ', $m)) {
			return [];
		}

		// 2. Decode HTML entities (like &apos; or &#39;) back into real characters
		$jsonRaw = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');

		// 3. Decode the resulting JSON string
		$decoded = json_decode($jsonRaw, true);

		return is_array($decoded) ? $decoded : [];
	}

    /**
     * Extract the info="…" attribute from the full match (not just the attr
     * string) so that embedded quotes inside the value are handled correctly.
     */
    private function extractInfo(string $fullMatch): string
    {
        if (preg_match('/\binfo="([^"]*)"/', $fullMatch, $m)) {
            return $m[1];
        }
        return '';
    }

    /**
     * Render the inline <script> that exposes poiData to eqmap.js.
     *
     * Keeping this as a separate method makes it easy to unit-test the JSON
     * shape without parsing HTML.
     *
     * @param array $data Parsed data from handle().
     */
    private function renderPoiDataScript(array $data): string
    {
        $poiData = [
            'centered'  => $data['centered'],
            'centerLat' => $data['centerLat'],
            'centerLon' => $data['centerLon'],
            'zoom'      => $data['zoom'],
            'pois'      => $data['pois'],
            'info'      => $data['info'],
            'debug'     => $data['debug'],
        ];

        $json = json_encode($poiData, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_QUOT);

		return '<script type="text/javascript">var poiData = ' . $json . ';</script>' . "\n";
    }

    /**
     * Render the map container div and its child overlay elements.
     *
     * @param array $data Parsed data from handle().
     */
    private function renderMapHtml(array $data): string
    {
        $style = $data['centered'] ? ' style="margin: auto;"' : '';

        return implode("\n", [
            '<div id="map" class="map"' . $style . '>',
            '  <div id="tooltip"></div>',
            '  <div id="map-info-overlay" class="map-info-hidden"></div>',
            '</div>',
            '',
        ]);
    }
}