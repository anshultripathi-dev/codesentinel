/* Tiny growable int vector (sample code for CodeSentinel demos). */
#include <stdlib.h>

struct vec {
    int *data;
    int len;
    int cap;
};

void vec_init(struct vec *v) {
    v->data = NULL;
    v->len = 0;
    v->cap = 0;
}

int vec_push(struct vec *v, int value) {
    if (v->len == v->cap) {
        int ncap = v->cap ? v->cap * 2 : 8;
        int *n = realloc(v->data, (size_t)ncap * sizeof(int));
        if (!n) {
            return -1;
        }
        v->data = n;
        v->cap = ncap;
    }
    v->data[v->len++] = value;
    return 0;
}

int vec_get(const struct vec *v, int index) {
    return v->data[index];
}

int vec_sum(const struct vec *v) {
    int total = 0;
    for (int i = 0; i < v->len; i++) {
        total += v->data[i];
    }
    return total;
}

void vec_free(struct vec *v) {
    free(v->data);
    vec_init(v);
}
