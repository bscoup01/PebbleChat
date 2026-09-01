#include <pebble.h>
#include "modules/relay.h"
int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  health_relay_init();
  
  moddable_createMachine(NULL);

  window_destroy(w);
}
