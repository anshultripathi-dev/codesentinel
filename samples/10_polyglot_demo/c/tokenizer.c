/* Hand-written expression tokenizer and evaluator (sample code for CodeSentinel demos). */
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum token_kind { T_END, T_NUM, T_IDENT, T_OP, T_LPAREN, T_RPAREN, T_COMMA, T_ERROR };

struct token {
    enum token_kind kind;
    char text[32];
    double value;
};

int next_token(const char *src, int pos, struct token *out, int *errors, int strict, int allow_hex) {
    int start;
    int len;
    out->value = 0;
    out->text[0] = '\0';
    while (src[pos] == ' ' || src[pos] == '\t' || src[pos] == '\n') {
        pos++;
    }
    if (src[pos] == '\0') {
        out->kind = T_END;
        return pos;
    }
    if (isdigit((unsigned char)src[pos]) || (src[pos] == '.' && isdigit((unsigned char)src[pos + 1]))) {
        start = pos;
        if (allow_hex && src[pos] == '0' && (src[pos + 1] == 'x' || src[pos + 1] == 'X')) {
            pos += 2;
            while (isxdigit((unsigned char)src[pos])) {
                pos++;
            }
            len = pos - start;
            if (len >= (int)sizeof(out->text)) {
                if (strict) {
                    (*errors)++;
                    out->kind = T_ERROR;
                    return pos;
                }
                len = (int)sizeof(out->text) - 1;
            }
            memcpy(out->text, src + start, len);
            out->text[len] = '\0';
            out->value = (double)strtol(out->text, NULL, 16);
            out->kind = T_NUM;
            return pos;
        }
        while (isdigit((unsigned char)src[pos]) || src[pos] == '.') {
            pos++;
        }
        if (src[pos] == 'e' || src[pos] == 'E') {
            pos++;
            if (src[pos] == '+' || src[pos] == '-') {
                pos++;
            }
            while (isdigit((unsigned char)src[pos])) {
                pos++;
            }
        }
        len = pos - start;
        if (len >= (int)sizeof(out->text)) {
            len = (int)sizeof(out->text) - 1;
        }
        memcpy(out->text, src + start, len);
        out->text[len] = '\0';
        out->value = atof(out->text);
        out->kind = T_NUM;
        return pos;
    }
    if (isalpha((unsigned char)src[pos]) || src[pos] == '_') {
        start = pos;
        while (isalnum((unsigned char)src[pos]) || src[pos] == '_') {
            pos++;
        }
        len = pos - start;
        if (len >= (int)sizeof(out->text)) {
            len = (int)sizeof(out->text) - 1;
        }
        memcpy(out->text, src + start, len);
        out->text[len] = '\0';
        out->kind = T_IDENT;
        return pos;
    }
    switch (src[pos]) {
    case '+': case '-': case '*': case '/': case '%': case '^':
        out->kind = T_OP; out->text[0] = src[pos]; out->text[1] = '\0';
        return pos + 1;
    case '<': case '>': case '=': case '!':
        out->kind = T_OP; out->text[0] = src[pos];
        if (src[pos + 1] == '=') {
            out->text[1] = '='; out->text[2] = '\0';
            return pos + 2;
        }
        out->text[1] = '\0';
        return pos + 1;
    case '&':
        if (src[pos + 1] == '&') { out->kind = T_OP; strcpy(out->text, "&&"); return pos + 2; }
        break;
    case '|':
        if (src[pos + 1] == '|') { out->kind = T_OP; strcpy(out->text, "||"); return pos + 2; }
        break;
    case '(':
        out->kind = T_LPAREN; return pos + 1;
    case ')':
        out->kind = T_RPAREN; return pos + 1;
    case ',':
        out->kind = T_COMMA; return pos + 1;
    default:
        break;
    }
    (*errors)++;
    out->kind = T_ERROR;
    out->text[0] = src[pos];
    out->text[1] = '\0';
    return pos + 1;
}

int precedence(const char *op) {
    if (strcmp(op, "||") == 0) return 1;
    if (strcmp(op, "&&") == 0) return 2;
    if (strcmp(op, "==") == 0 || strcmp(op, "!=") == 0) return 3;
    if (op[0] == '<' || op[0] == '>') return 4;
    if (op[0] == '+' || op[0] == '-') return 5;
    if (op[0] == '*' || op[0] == '/' || op[0] == '%') return 6;
    if (op[0] == '^') return 7;
    return 0;
}

int is_right_assoc(const char *op) {
    return op[0] == '^';
}
