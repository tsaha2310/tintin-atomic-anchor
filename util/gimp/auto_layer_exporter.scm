(define (script-fu-export-layers-to-composer image drawable output-dir)
  ; 1. Duplicate the entire image so we do NOT destroy the user's workspace!
  (let* (
         (dup-image (car (gimp-image-duplicate image)))
         (layers-array (cadr (gimp-image-get-layers dup-image)))
         (num-layers (car (gimp-image-get-layers dup-image)))
         (json-file (string-append output-dir "/auto_assets.json"))
         (port (open-output-file json-file))
         (is-first #t)
         (i 0)
        )
    
    ; Disable undo on the duplicate to speed up processing and prevent memory leaks
    (gimp-image-undo-disable dup-image)

    (display "{\n  \"characters_custom\": {\n" port)
    
    (while (< i num-layers)
      (let* (
             (layer (aref layers-array i))
             (layer-name (car (gimp-item-get-name layer)))
             (is-vis-val (car (gimp-item-get-visible layer)))
             (is-visible (not (or (equal? is-vis-val 0) (equal? is-vis-val #f))))
             (is-bg (or (string=? layer-name "background") (string=? layer-name "Background")))
            )
        
        (if (and is-visible (not is-bg))
            (begin
              ; Autocrop the layer on the safe duplicate image
              (plug-in-autocrop-layer RUN-NONINTERACTIVE dup-image layer)
              
              (let* (
                     (offset-x (car (gimp-drawable-offsets layer)))
                     (offset-y (cadr (gimp-drawable-offsets layer)))
                     (width (car (gimp-drawable-width layer)))
                     (height (car (gimp-drawable-height layer)))
                     (filename (string-append layer-name ".png"))
                     (filepath (string-append output-dir "/" filename))
                     
                     ; Create a temp image exactly the size of the cropped layer
                     (temp-image (car (gimp-image-new width height (car (gimp-image-base-type dup-image)))))
                     (temp-layer (car (gimp-layer-new-from-drawable layer temp-image)))
                    )
                
                (gimp-image-insert-layer temp-image temp-layer 0 0)
                ; Force the layer to sit at 0,0 in the new temp image before saving
                (gimp-layer-set-offsets temp-layer 0 0) 
                
                (file-png-save RUN-NONINTERACTIVE temp-image temp-layer filepath filename 0 9 1 1 1 1 1)
                (gimp-image-delete temp-image)
                
                (if (not is-first)
                    (display ",\n" port)
                )
                (set! is-first #f)
                
                (display (string-append "    \"" layer-name "\": {\n") port)
                (display (string-append "      \"src\": \"assets/" filename "\",\n") port)
                (display (string-append "      \"w\": " (number->string width) ",\n") port)
                (display (string-append "      \"h\": " (number->string height) ",\n") port)
                (display (string-append "      \"originalX\": " (number->string offset-x) ",\n") port)
                (display (string-append "      \"originalY\": " (number->string offset-y) "\n") port)
                (display "    }" port)
              )
            )
        )
      )
      (set! i (+ i 1))
    )
    
    (display "\n  }\n}\n" port)
    (close-output-port port)
    
    ; Clean up the duplicate image 
    (gimp-image-delete dup-image)
    
    (gimp-message "Exported layers and generated auto_assets.json successfully!")
    (gimp-displays-flush)
  )
  ; Explicitly return an empty list to prevent the progress callback crash
  '()
)

(script-fu-register
  "script-fu-export-layers-to-composer"
  "Export Layers to Composer..."
  "Autocrops visible layers, exports PNGs, and generates an assets JSON with original offsets."
  "Pipeline Tool"
  "Pipeline Tool"
  "2026"
  "*" 
  SF-IMAGE       "Image"          0
  SF-DRAWABLE    "Drawable"       0
  SF-DIRNAME     "Output Directory" ""
)

(script-fu-menu-register "script-fu-export-layers-to-composer" "<Image>/Filters/Character Pipeline")
