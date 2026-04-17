<?php

use dokuwiki\Logger;

/**
 * All DokuWiki plugins to extend the parser/rendering mechanism
 * need to inherit from this class
 */
class syntax_plugin_eqmap extends DokuWiki_Syntax_Plugin {
 
 
 
   /**
    * Get the type of syntax this plugin defines.
    *
    * @param none
    * @return String <tt>'substition'</tt> (i.e. 'substitution').
    * @public
    * @static
    */
    function getType(){
        return 'substition';
    }

 
   /**
    * Define how this plugin is handled regarding paragraphs.
    *
    * <p>
    * This method is important for correct XHTML nesting. It returns
    * one of the following values:
    * </p>
    * <dl>
    * <dt>normal</dt><dd>The plugin can be used inside paragraphs.</dd>
    * <dt>block</dt><dd>Open paragraphs need to be closed before
    * plugin output.</dd>
    * <dt>stack</dt><dd>Special case: Plugin wraps other paragraphs.</dd>
    * </dl>
    * @param none
    * @return String <tt>'block'</tt>.
    * @public
    * @static
    */
    function getPType(){
        return 'block';
    }
 
   /**
    * Where to sort in?
    *
    * @param none
    * @return Integer <tt>6</tt>.
    * @public
    * @static
    */
    function getSort(){
        return 901;
    }
 
 
   /**
    * Connect lookup pattern to lexer.
    *
    * @param $aMode String The desired rendermode.
    * @return none
    * @public
    * @see render()
    */
    function connectTo($mode) {
      $this->Lexer->addSpecialPattern('<eqmap ?[^>\n]*>.*?</eqmap>',$mode,'plugin_eqmap');
    }
 
 
 
   /**
    * Handler to prepare matched data for the rendering process.
    *
    * <p>
    * The <tt>$aState</tt> parameter gives the type of pattern
    * which triggered the call to this method:
    * </p>
    * <dl>
    * <dt>DOKU_LEXER_ENTER</dt>
    * <dd>a pattern set by <tt>addEntryPattern()</tt></dd>
    * <dt>DOKU_LEXER_MATCHED</dt>
    * <dd>a pattern set by <tt>addPattern()</tt></dd>
    * <dt>DOKU_LEXER_EXIT</dt>
    * <dd> a pattern set by <tt>addExitPattern()</tt></dd>
    * <dt>DOKU_LEXER_SPECIAL</dt>
    * <dd>a pattern set by <tt>addSpecialPattern()</tt></dd>
    * <dt>DOKU_LEXER_UNMATCHED</dt>
    * <dd>ordinary text encountered within the plugin's syntax mode
    * which doesn't match any pattern.</dd>
    * </dl>
    * @param $aMatch String The text matched by the patterns.
    * @param $aState Integer The lexer state for the match.
    * @param $aPos Integer The character position of the matched text.
    * @param $aHandler Object Reference to the Doku_Handler object.
    * @return Integer The current lexer state for the match.
    * @public
    * @see render()
    * @static
    */
    function handle($match, $state, $pos, Doku_Handler $handler){
		$_tag       = explode('>', substr($match, 7, -8), 2);
        $str_params = $_tag[0];
		
		$centered = false;
		$matches = [];
		preg_match('/(centered)/', $str_params, $matches);
		$centered_provided = count($matches) === 2;
		if ($centered_provided) {
			$centered = true;
		}
		
		$center_lat = null;
		$matches = [];
		preg_match('/centerLat=(\d+(?:\.\d+)?)/', $str_params, $matches);
		$center_lat_provided = count($matches) === 2;
		if ($center_lat_provided) {
			$center_lat = $matches[1];
		}
		
		$center_lon = null;
		$matches = [];
		preg_match('/centerLon=(\d+(?:\.\d+)?)/', $str_params, $matches);
		$center_lon_provided = count($matches) === 2;
		if ($center_lon_provided) {
			$center_lon = $matches[1];
		}
		
		$zoom = null;
		$matches = [];
		preg_match('/zoom=(\d+)/', $str_params, $matches);
		$zoom_provided = count($matches) === 2;
		if ($zoom_provided) {
			$zoom = $matches[1];
		}
		
		$poi_array = [];
		$matches = [];
		preg_match('/poi=[\'"](.*)[\'"]/', $str_params, $matches);
		$poi_provided = count($matches) === 2;
		if ($poi_provided) {
			$poi_array = json_decode($matches[1]);
		}
		
        return [$centered, $center_lat, $center_lon, $zoom, $poi_array];
    }
 
   /**
    * Handle the actual output creation.
    *
    * <p>
    * The method checks for the given <tt>$aFormat</tt> and returns
    * <tt>FALSE</tt> when a format isn't supported. <tt>$aRenderer</tt>
    * contains a reference to the renderer object which is currently
    * handling the rendering. The contents of <tt>$aData</tt> is the
    * return value of the <tt>handle()</tt> method.
    * </p>
    * @param $aFormat String The output format to generate.
    * @param $aRenderer Object A reference to the renderer object.
    * @param $aData Array The data created by the <tt>handle()</tt>
    * method.
    * @return Boolean <tt>TRUE</tt> if rendered successfully, or
    * <tt>FALSE</tt> otherwise.
    * @public
    * @see handle()
    */
    function render($mode, Doku_Renderer $renderer, $data) {
        if($mode == 'xhtml'){
			[$centered, $center_lat, $center_lon, $zoom, $poi_array] = $data;
			
			$poi_array_string = json_encode($poi_array);
			
			$poi_data = new StdClass;
			
			$poi_data->centered = $centered;
			$poi_data->centerLat = $center_lat;
			$poi_data->centerLon = $center_lon;
			$poi_data->zoom = $zoom;
			$poi_data->pois = $poi_array_string;
			
			$poi_data_json = json_encode($poi_data);
			
			$renderer->doc .= '<script defer="defer" src="data:text/javascript;base64,';
            $renderer->doc .= base64_encode("poiData = $poi_data_json");
            $renderer->doc .= '"></script>';
			
            $renderer->doc .= '<div id="map"';
			if ($centered) {
				$renderer->doc .= ' style="margin: auto;"';
			}
			$renderer->doc .= ' class="map"><div id="tooltip"></div></div>';     // ptype = 'block'
            return true;
        }
        return false;
    }
}