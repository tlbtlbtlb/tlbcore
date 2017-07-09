#pragma once

#define profts(LABEL, DATA) { if (profts_active) profts_real((LABEL), (DATA)); }

void profts_start();
extern int profts_active;
void profts_dump(int mincount);
const char * profts_dump_str();
void profts_real(const char *label, int data);
